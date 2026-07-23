import { db } from "../db";
import { sppInvoices, payments } from "../db/schema";
import { users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { snap, coreApi } from "../lib/midtrans";
import crypto from "crypto";
import { logAudit } from "../lib/audit-logger";
import { env } from "../validations/env";
import { logger } from "../lib/logger";
import { PAYMENT_STATUS, PAYMENT_CONFIG, PaymentStatus } from "../lib/constants";

// Metode pembayaran yang langsung sukses tanpa fraud_status (QRIS, e-wallet, direct debit).
// Pada metode ini Midtrans sering mengirim transaction_status "capture" tanpa fraud_status,
// namun pembayaran sebenarnya sudah berhasil -> harus dianggap PAID.
const DIRECT_PAYMENT_METHODS = ["qris", "gopay", "shopeepay", "danamon_online", "akulaku", "kreditmu"];

/**
 * Memetakan transaction_status (+ fraud_status + payment_type) dari Midtrans ke PaymentStatus internal.
 * Dipakai bersama oleh handleWebhook dan endpoint cek status agar mapping selalu konsisten.
 */
export function mapMidtransStatus(
  transactionStatus: string | undefined,
  fraudStatus: string | undefined | null,
  paymentType: string | undefined
): PaymentStatus {
  if (transactionStatus === "capture") {
    const isDirect = DIRECT_PAYMENT_METHODS.includes((paymentType || "").toLowerCase());
    if (fraudStatus === "accept") return PAYMENT_STATUS.PAID;
    if (fraudStatus === "challenge") return PAYMENT_STATUS.CHALLENGE;
    if (fraudStatus === "deny") return PAYMENT_STATUS.FAILED;
    // fraud_status kosong: sukses untuk metode direct (QRIS/e-wallet), CHALLENGE untuk kartu kredit biasa.
    if (fraudStatus === undefined || fraudStatus === null) {
      return isDirect ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.CHALLENGE;
    }
    return PAYMENT_STATUS.CHALLENGE;
  }
  if (transactionStatus === "settlement") return PAYMENT_STATUS.PAID;
  if (transactionStatus === "cancel") return PAYMENT_STATUS.CANCELLED;
  if (transactionStatus === "deny" || transactionStatus === "failure") return PAYMENT_STATUS.FAILED;
  if (transactionStatus === "expire") return PAYMENT_STATUS.EXPIRED;
  if (transactionStatus === "pending") return PAYMENT_STATUS.PENDING;
  if (transactionStatus === "refund") return PAYMENT_STATUS.REFUNDED;
  if (transactionStatus === "chargeback") return PAYMENT_STATUS.CHARGEBACK;
  if (transactionStatus === "authorize") return PAYMENT_STATUS.AUTHORIZED;
  return PAYMENT_STATUS.PENDING;
}

export class PaymentService {
  static async createPayment(invoiceId: string, userId: string) {
    const invoice = await db.query.sppInvoices.findFirst({
      where: and(eq(sppInvoices.id, invoiceId), eq(sppInvoices.studentId, userId)),
    });

    if (!invoice) {
      throw new Error("Invoice tidak ditemukan");
    }

    if (invoice.status === PAYMENT_STATUS.PAID) {
      throw new Error("Invoice sudah dibayar");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const existingPending = await db.query.payments.findFirst({
      where: and(eq(payments.invoiceId, invoice.id), eq(payments.status, PAYMENT_STATUS.PENDING)),
      orderBy: (payments, { desc }) => [desc(payments.createdAt)]
    });

    if (existingPending) {
      const now = new Date().getTime();
      const createdAt = new Date(existingPending.createdAt).getTime();
      const hoursDiff = (now - createdAt) / (1000 * 60 * 60);

      if (hoursDiff < PAYMENT_CONFIG.EXPIRED_HOURS && existingPending.snapToken) {
        await logAudit('PAYMENT_PENDING_REUSED', existingPending.orderId, { invoiceId: invoice.id });
        return {
          orderId: existingPending.orderId,
          token: existingPending.snapToken,
          redirectUrl: existingPending.redirectUrl,
        };
      } else {
        await logAudit('PAYMENT_EXPIRED', existingPending.orderId);
        await db.update(payments)
          .set({ status: PAYMENT_STATUS.EXPIRED, updatedAt: new Date() })
          .where(eq(payments.id, existingPending.id));
      }
    }

    const orderId = `SPP-${invoice.id.substring(0, 8)}-${Date.now()}`;

    const snapParams: any = {
      transaction_details: {
        order_id: orderId,
        gross_amount: invoice.amount,
      },
      customer_details: {
        first_name: user?.name || "Siswa",
        email: user?.email || "student@example.com",
      },
      item_details: [
        {
          id: `SPP-${invoice.month}-${invoice.year}`,
          price: invoice.amount,
          quantity: 1,
          name: `SPP Bulan ${invoice.month} Tahun ${invoice.year}`,
        },
      ],
    };

    // Daftarkan URL webhook eksplisit per transaksi agar Midtrans selalu memanggil endpoint kita,
    // meskipun konfigurasi default di dashboard belum/berubah.
    if (env.WEBHOOK_URL) {
      snapParams.notification_url = env.WEBHOOK_URL;
    }

    const snapResponse = await snap.createTransaction(snapParams);

    await db.insert(payments).values({
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      orderId: orderId,
      amount: invoice.amount,
      status: PAYMENT_STATUS.PENDING,
      snapToken: snapResponse.token,
      redirectUrl: snapResponse.redirect_url,
    });

    await logAudit('PAYMENT_CREATED', orderId, { invoiceId: invoice.id, amount: invoice.amount });

    return {
      orderId,
      token: snapResponse.token,
      redirectUrl: snapResponse.redirect_url,
    };
  }

  static async handleWebhook(notification: any) {
    const serverKey = env.MIDTRANS_SERVER_KEY;
    const hashString = `${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`;
    const signature = crypto.createHash("sha512").update(hashString).digest("hex");

    if (signature !== notification.signature_key) {
      await logAudit('WEBHOOK_INVALID_SIGNATURE', notification.order_id);
      throw new Error("Invalid signature");
    }

    // Verifikasi otoritatif ke server Midtrans (best practice anti-spoofing).
    // Hasil status dari server Midtrans dipakai sebagai sumber kebenaran, BUKAN body notifikasi.
    let verified = notification;
    try {
      verified = await coreApi.transaction.notification(notification);
    } catch (err: any) {
      // Jika verifikasi gagal (mis. transaksi belum tercatat / gangguan), fallback ke body notifikasi
      // yang sudah lulus signature check di atas.
      logger.warn({ err: err.message, order_id: notification.order_id }, "Midtrans status verification failed, falling back to notification body");
      await logAudit('WEBHOOK_VERIFY_FAILED_FALLBACK', notification.order_id, { message: err.message });
    }

    return await db.transaction(async (tx) => {
      const paymentRows = await tx.select()
        .from(payments)
        .where(eq(payments.orderId, verified.order_id || notification.order_id))
        .limit(1)
        .for("update");

      const payment = paymentRows[0];

      if (!payment) {
        await logAudit('WEBHOOK_INVALID_ORDER_ID', notification.order_id, null, tx);
        throw new Error("Payment record not found");
      }

      if (payment.status === PAYMENT_STATUS.PAID) {
        await logAudit('WEBHOOK_DUPLICATE_CALLBACK_PAID', notification.order_id, null, tx);
        return { success: true };
      }

      if (payment.amount !== parseInt(verified.gross_amount ?? notification.gross_amount)) {
        await logAudit('WEBHOOK_INVALID_AMOUNT', notification.order_id, { expected: payment.amount, received: verified.gross_amount ?? notification.gross_amount }, tx);
        throw new Error("Invalid amount");
      }

      const { transaction_status: transactionStatus, fraud_status: fraudStatus, payment_type: paymentType } = verified;
      const newStatus: PaymentStatus = mapMidtransStatus(transactionStatus, fraudStatus, paymentType);

      const paymentUpdateData: any = {
        status: newStatus,
        paymentMethod: verified.payment_type ?? notification.payment_type,
        midtransTransactionId: verified.transaction_id ?? notification.transaction_id,
        updatedAt: new Date(),
        fraudStatus: verified.fraud_status ?? notification.fraud_status,
        bank: verified.va_numbers?.[0]?.bank || verified.bank || notification.va_numbers?.[0]?.bank || notification.bank,
        paymentType: verified.payment_type ?? notification.payment_type,
        vaNumber: verified.va_numbers?.[0]?.va_number || notification.va_numbers?.[0]?.va_number,
        settlementTime: (verified.settlement_time || notification.settlement_time) ? new Date(verified.settlement_time || notification.settlement_time) : undefined,
        acquirer: verified.bank ?? notification.bank,
        issuer: verified.issuer ?? notification.issuer,
        channelResponseCode: verified.status_code ?? notification.status_code,
        channelResponseMessage: verified.status_message ?? notification.status_message,
      };

      if (newStatus === PAYMENT_STATUS.PAID) {
        paymentUpdateData.paidAt = new Date();
      }

      await tx
        .update(payments)
        .set(paymentUpdateData)
        .where(eq(payments.id, payment.id));

      if (newStatus === PAYMENT_STATUS.PAID) {
        await tx
          .update(sppInvoices)
          .set({ status: PAYMENT_STATUS.PAID, updatedAt: new Date() })
          .where(eq(sppInvoices.id, payment.invoiceId));
          
        await logAudit('PAYMENT_PAID', notification.order_id, { amount: payment.amount }, tx);
      } else if (([PAYMENT_STATUS.FAILED, PAYMENT_STATUS.EXPIRED, PAYMENT_STATUS.CANCELLED, PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.CHARGEBACK] as PaymentStatus[]).includes(newStatus)) {
        await logAudit(`PAYMENT_${newStatus}`, notification.order_id, null, tx);
      }

      return { success: true };
    });
  }

  /**
   * Cek status pembayaran langsung ke server Midtrans (jalur pull / on-demand).
   * Dipakai endpoint /payments/status/:orderId agar frontend bisa polling walau webhook tidak sampai.
   * Mengupdate payments + spp_invoices jika status berubah (idempoten).
   * userId dipakai untuk memastikan order milik user yang meminta.
   */
  static async checkStatus(orderId: string, userId: string) {
    // Ambil payment + invoice sekaligus untuk verifikasi kepemilikan
    const rows = await db
      .select({ payment: payments, invoice: sppInvoices })
      .from(payments)
      .innerJoin(sppInvoices, eq(sppInvoices.id, payments.invoiceId))
      .where(eq(payments.orderId, orderId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      throw new Error("Payment record not found");
    }

    // Pastikan order milik user yang meminta
    if (row.invoice.studentId !== userId) {
      throw new Error("Anda tidak berhak mengakses pembayaran ini");
    }

    console.log("\n=====================");
    console.log(`[RUNTIME DEBUG] Incoming orderId: ${orderId}`);
    console.log(`[RUNTIME DEBUG] Status dari database sebelum update: ${row.payment.status}`);

    // Idempoten: kalau sudah PAID, langsung kembalikan tanpa call Midtrans
    if (row.payment.status === PAYMENT_STATUS.PAID) {
      console.log(`[RUNTIME DEBUG] Status sudah PAID, mengembalikan tanpa update Midtrans`);
      console.log("=====================\n");
      return {
        status: PAYMENT_STATUS.PAID,
        invoiceStatus: row.invoice.status,
      };
    }

    // Ambil status otoritatif dari server Midtrans
    const midtransStatus = await coreApi.transaction.status(orderId);
    console.log(`[RUNTIME DEBUG] Response asli dari Midtrans:`, JSON.stringify(midtransStatus));
    console.log(`[RUNTIME DEBUG] transaction_status: ${midtransStatus.transaction_status}`);
    console.log(`[RUNTIME DEBUG] fraud_status: ${midtransStatus.fraud_status}`);
    console.log(`[RUNTIME DEBUG] gross_amount: ${midtransStatus.gross_amount}`);

    const newStatus: PaymentStatus = mapMidtransStatus(
      midtransStatus.transaction_status,
      midtransStatus.fraud_status,
      midtransStatus.payment_type
    );
    console.log(`[RUNTIME DEBUG] Status hasil mapping: ${newStatus}`);

    let isDbUpdated = false;
    let updatedRowsCount = 0;

    // Hanya update bila ada perubahan
    if (newStatus !== row.payment.status) {
      isDbUpdated = true;
      console.log(`[RUNTIME DEBUG] Apakah blok update database dijalankan: YA`);
      await db.transaction(async (tx) => {
        const updateData: any = {
          status: newStatus,
          updatedAt: new Date(),
          paymentType: midtransStatus.payment_type,
          midtransTransactionId: midtransStatus.transaction_id ?? row.payment.midtransTransactionId,
          fraudStatus: midtransStatus.fraud_status,
          channelResponseCode: String(midtransStatus.status_code ?? ""),
          channelResponseMessage: midtransStatus.status_message,
        };

        if (newStatus === PAYMENT_STATUS.PAID) {
          updateData.paidAt = new Date();
        }

        const updatedPayments = await tx.update(payments).set(updateData).where(eq(payments.id, row.payment.id)).returning({ id: payments.id });
        updatedRowsCount += updatedPayments.length;

        if (newStatus === PAYMENT_STATUS.PAID) {
          const updatedInvoices = await tx
            .update(sppInvoices)
            .set({ status: PAYMENT_STATUS.PAID, updatedAt: new Date() })
            .where(eq(sppInvoices.id, row.invoice.id))
            .returning({ id: sppInvoices.id });
          updatedRowsCount += updatedInvoices.length;
          await logAudit('PAYMENT_PAID', orderId, { amount: row.payment.amount, via: 'status_check' }, tx);
        }
      });
      console.log(`[RUNTIME DEBUG] Jumlah row yang di-update: ${updatedRowsCount}`);
    } else {
      console.log(`[RUNTIME DEBUG] Apakah blok update database dijalankan: TIDAK (status sama)`);
    }

    // Ambil status invoice terbaru setelah kemungkinan update
    const refreshedInvoice = await db.query.sppInvoices.findFirst({
      where: eq(sppInvoices.id, row.invoice.id),
    });
    console.log(`[RUNTIME DEBUG] Status invoice setelah update: ${refreshedInvoice?.status ?? row.invoice.status}`);

    const responseData = {
      status: newStatus,
      invoiceStatus: refreshedInvoice?.status ?? row.invoice.status,
    };
    console.log(`[RUNTIME DEBUG] Response yang dikirim (internal):`, JSON.stringify(responseData));
    console.log("=====================\n");

    return responseData;
  }
}
