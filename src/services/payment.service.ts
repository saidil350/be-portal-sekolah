import { db } from "../db";
import { sppInvoices, payments } from "../db/schema";
import { users } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
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
    const adminFee = Math.round(invoice.amount * PAYMENT_CONFIG.ADMIN_FEE_PERCENTAGE);
    const totalAmount = invoice.amount + adminFee;

    const snapParams: any = {
      transaction_details: {
        order_id: orderId,
        gross_amount: totalAmount,
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
        {
          id: `ADMIN-FEE`,
          price: adminFee,
          quantity: 1,
          name: `Biaya Administrasi (1%)`,
        },
      ],
    };

    // Daftarkan URL webhook eksplisit per transaksi agar Midtrans selalu memanggil endpoint kita,
    // meskipun konfigurasi default di dashboard belum/berubah.
    if (env.WEBHOOK_URL) {
      snapParams.notification_url = env.WEBHOOK_URL;
    }

    const snapResponse = await snap.createTransaction(snapParams);
    const paymentNumber = `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await db.insert(payments).values({
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      paymentNumber: paymentNumber,
      orderId: orderId,
      amount: totalAmount,
      status: PAYMENT_STATUS.PENDING,
      snapToken: snapResponse.token,
      redirectUrl: snapResponse.redirect_url,
    });

    await logAudit('PAYMENT_CREATED', orderId, { invoiceId: invoice.id, amount: invoice.amount, adminFee, totalAmount, paymentNumber }, undefined, invoice.tenantId);

    return {
      orderId,
      token: snapResponse.token,
      redirectUrl: snapResponse.redirect_url,
      amount: invoice.amount,
      adminFee,
      totalAmount,
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
        await logAudit('WEBHOOK_DUPLICATE_CALLBACK_PAID', notification.order_id, null, tx, payment.tenantId);
        return { success: true };
      }

      if (payment.amount !== parseInt(verified.gross_amount ?? notification.gross_amount)) {
        await logAudit('WEBHOOK_INVALID_AMOUNT', notification.order_id, { expected: payment.amount, received: verified.gross_amount ?? notification.gross_amount }, tx, payment.tenantId);
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
          
        await logAudit('PAYMENT_PAID', notification.order_id, { amount: payment.amount }, tx, payment.tenantId);
      } else if (([PAYMENT_STATUS.FAILED, PAYMENT_STATUS.EXPIRED, PAYMENT_STATUS.CANCELLED, PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.CHARGEBACK] as PaymentStatus[]).includes(newStatus)) {
        await logAudit(`PAYMENT_${newStatus}`, notification.order_id, null, tx, payment.tenantId);
      }

      return { success: true };
    });
  }

  /**
   * Cek status pembayaran langsung ke server Midtrans (jalur pull / on-demand).
   * Verifikasi kepemilikan transaksi berdasarkan userId siswa.
   */
  static async checkStatus(orderId: string, userId: string) {
    const rows = await db
      .select({
        payment: payments,
        invoice: sppInvoices,
      })
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

    logger.debug({ orderId, status: row.payment.status }, "Incoming order status check");

    // Idempoten: kalau sudah PAID, langsung kembalikan tanpa call Midtrans
    if (row.payment.status === PAYMENT_STATUS.PAID) {
      return {
        status: PAYMENT_STATUS.PAID,
        invoiceStatus: row.invoice.status,
      };
    }

    // Ambil status otoritatif dari server Midtrans
    const midtransStatus = await coreApi.transaction.status(orderId);
    logger.debug({ orderId, midtransStatus }, "Response status dari Midtrans");

    const newStatus: PaymentStatus = mapMidtransStatus(
      midtransStatus.transaction_status,
      midtransStatus.fraud_status,
      midtransStatus.payment_type
    );

    // Hanya update bila ada perubahan
    if (newStatus !== row.payment.status) {
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

        await tx.update(payments).set(updateData).where(eq(payments.id, row.payment.id));

        if (newStatus === PAYMENT_STATUS.PAID) {
          await tx
            .update(sppInvoices)
            .set({ status: PAYMENT_STATUS.PAID, updatedAt: new Date() })
            .where(eq(sppInvoices.id, row.invoice.id));
          await logAudit('PAYMENT_PAID', orderId, { amount: row.payment.amount, via: 'status_check' }, tx, row.payment.tenantId);
        }
      });
    }

    // Ambil status invoice terbaru setelah kemungkinan update
    const refreshedInvoice = await db.query.sppInvoices.findFirst({
      where: eq(sppInvoices.id, row.invoice.id),
    });

    return {
      status: newStatus,
      invoiceStatus: refreshedInvoice?.status ?? row.invoice.status,
    };
  }

  /**
   * Sinkronisasi status pembayaran dengan Midtrans oleh Admin.
   * Tidak membatasi kepemilikan userId (khusus admin).
   * Memeriksa semua attempt pembayaran (orderId) yang pernah dibuat untuk invoice ini.
   */
  static async syncPayment(invoiceId: string) {
    const rows = await db
      .select({ payment: payments, invoice: sppInvoices })
      .from(payments)
      .innerJoin(sppInvoices, eq(sppInvoices.id, payments.invoiceId))
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.createdAt));

    if (rows.length === 0) {
      throw new Error("Belum ada transaksi pembayaran yang dibuat untuk invoice ini");
    }

    const invoice = rows[0].invoice;

    // Idempoten jika sudah PAID di database
    if (invoice.status === PAYMENT_STATUS.PAID) {
      return {
        status: PAYMENT_STATUS.PAID,
        invoiceStatus: PAYMENT_STATUS.PAID,
      };
    }

    let overallNewStatus: PaymentStatus = PAYMENT_STATUS.PENDING;
    let foundPaid = false;
    let paidOrderAttempt: typeof rows[0] | null = null;

    // Cek semua attempt pembayaran untuk invoice ini
    for (const row of rows) {
      try {
        const midtransStatus = await coreApi.transaction.status(row.payment.orderId);
        const newStatus: PaymentStatus = mapMidtransStatus(
          midtransStatus.transaction_status,
          midtransStatus.fraud_status,
          midtransStatus.payment_type
        );

        if (newStatus === PAYMENT_STATUS.PAID) {
          foundPaid = true;
          overallNewStatus = PAYMENT_STATUS.PAID;
          paidOrderAttempt = row;
        } else if (newStatus !== row.payment.status && !foundPaid) {
          // Keep track of the latest non-paid status if not paid yet
          overallNewStatus = newStatus;
        }

        // Update database untuk payment attempt ini jika status berubah
        if (newStatus !== row.payment.status) {
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

            await tx.update(payments).set(updateData).where(eq(payments.id, row.payment.id));
          });
        }
      } catch (err: any) {
        // Abaikan error (seperti 404 dari Midtrans karena user tidak menyelesaikan pembuatan token snap)
        console.warn(`Gagal cek status orderId ${row.payment.orderId}:`, err.message);
      }
    }

    // Jika salah satu payment attempt bernilai PAID, update status invoice menjadi PAID
    if (overallNewStatus === PAYMENT_STATUS.PAID) {
      await db
        .update(sppInvoices)
        .set({ status: PAYMENT_STATUS.PAID, updatedAt: new Date() })
        .where(eq(sppInvoices.id, invoiceId));
      
      const activeAttempt = paidOrderAttempt || rows[0];
      await logAudit('PAYMENT_PAID', activeAttempt.payment.orderId, { amount: activeAttempt.payment.amount, via: 'admin_sync' });
    } else if (([PAYMENT_STATUS.FAILED, PAYMENT_STATUS.EXPIRED, PAYMENT_STATUS.CANCELLED] as PaymentStatus[]).includes(overallNewStatus)) {
      // Jika status terburuk gagal/cancel/expire dan tidak ada yang PAID
      await db
        .update(sppInvoices)
        .set({ status: overallNewStatus, updatedAt: new Date() })
        .where(eq(sppInvoices.id, invoiceId));
      await logAudit(`PAYMENT_${overallNewStatus}`, rows[0].payment.orderId);
    }

    const refreshedInvoice = await db.query.sppInvoices.findFirst({
      where: eq(sppInvoices.id, invoiceId),
    });

    return {
      status: overallNewStatus,
      invoiceStatus: refreshedInvoice?.status ?? invoice.status,
    };
  }
}

