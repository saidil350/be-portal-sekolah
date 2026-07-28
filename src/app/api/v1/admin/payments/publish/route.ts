import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { sppInvoices, users, sppTariffs, notifications } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit-logger";

const publishSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
  dueDate: z.string().optional(),
  overrideAmount: z.number().min(0).optional(),
  targetType: z.enum(["ALL", "GRADE", "STUDENTS"]),
  targetGrade: z.string().optional(),
  studentIds: z.array(z.string().uuid()).optional(),
});

export const POST = withErrorHandler(
  withRole(["ADMIN_IT"], async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) return errorResponse("Tenant context missing", 400);

    const body = await req.json();
    const parsed = publishSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Payload tidak valid", 400, parsed.error.errors);
    }

    const { month, year, dueDate, overrideAmount, targetType, targetGrade, studentIds } = parsed.data;

    // 1. Ambil daftar siswa aktif yang sesuai dengan filter
    const userConditions: any[] = [
      eq(users.tenantId, tenantId),
      eq(users.role, "SISWA"),
    ];

    if (targetType === "STUDENTS" && studentIds && studentIds.length > 0) {
      userConditions.push(inArray(users.id, studentIds));
    }

    const targetStudents = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(...userConditions));

    if (targetStudents.length === 0) {
      return errorResponse("Tidak ada siswa yang ditemukan untuk diterbitkan tagihan.", 404);
    }

    // 2. Ambil tarif default jika overrideAmount tidak diisi
    let defaultAmount = 450000;
    if (overrideAmount !== undefined && overrideAmount !== null) {
      defaultAmount = overrideAmount;
    } else {
      const activeTariff = await db.query.sppTariffs.findFirst({
        where: and(eq(sppTariffs.tenantId, tenantId), eq(sppTariffs.isActive, true)),
      });
      if (activeTariff) {
        defaultAmount = activeTariff.amount;
      }
    }

    // 3. Tentukan Tanggal Jatuh Tempo
    const invoiceDueDate = dueDate ? new Date(dueDate) : new Date(year, month - 1, 10);
    const formattedMonth = String(month).padStart(2, '0');
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const monthLabel = monthNames[month - 1] || formattedMonth;

    let createdCount = 0;
    let skippedCount = 0;

    for (const student of targetStudents) {
      // Cek apakah invoice sudah pernah diterbitkan untuk siswa pada bulan & tahun tersebut
      const existing = await db.query.sppInvoices.findFirst({
        where: and(
          eq(sppInvoices.tenantId, tenantId),
          eq(sppInvoices.studentId, student.id),
          eq(sppInvoices.month, month),
          eq(sppInvoices.year, year)
        ),
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      // Generate invoice number unik: INV-SPP-YYYYMM-[4 digit random]
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-SPP-${year}${formattedMonth}-${randomSuffix}-${student.id.substring(0, 4).toUpperCase()}`;

      await db.insert(sppInvoices).values({
        tenantId,
        studentId: student.id,
        invoiceNumber,
        month,
        year,
        amount: defaultAmount,
        dueDate: invoiceDueDate,
        status: "PENDING",
      });

      // Kirim Notifikasi Sistem ke Siswa
      const formattedAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(defaultAmount);
      await db.insert(notifications).values({
        tenantId,
        userId: student.id,
        title: `Tagihan SPP ${monthLabel} ${year}`,
        message: `Tagihan SPP Anda untuk bulan ${monthLabel} ${year} sebesar ${formattedAmount} telah diterbitkan dan dapat dilakukan pembayaran melalui portal.`,
        type: "BILLING",
        isRead: false,
      });

      createdCount++;
    }

    await logAudit({
      tenantId,
      userId: authSession.user.id,
      userRole: authSession.user.role,
      action: "PUBLISH_SPP_INVOICES",
      module: "PAYMENT",
      details: {
        month,
        year,
        amount: defaultAmount,
        targetType,
        createdCount,
        skippedCount,
      },
    });

    return successResponse({
      message: `Berhasil menerbitkan ${createdCount} invoice SPP. (${skippedCount} siswa disetujui/sudah pernah terbit)`,
      createdCount,
      skippedCount,
      amountUsed: defaultAmount,
    });
  })
);
