import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { sppInvoices, users, sppTariffs, notifications } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit-logger";
import { createSPPPaymentPublishedNotification } from "@/lib/notification-templates";
import { emitToUser } from "@/websocket";

function mapNotificationToResponse(n: any) {
  return {
    id: n.id,
    tenantId: n.tenantId,
    title: n.title,
    message: n.message,
    type: n.type,
    userId: n.userId,
    isRead: n.isRead,
    readAt: n.readAt?.toISOString() || null,
    link: n.link,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}


const publishSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
  dueDate: z.string().optional(),
  overrideAmount: z.number().positive("Nominal override SPP harus lebih besar dari 0").optional(),
  targetType: z.enum(["ALL", "GRADE", "STUDENTS"]),
  targetGrade: z.string().optional(),
  studentIds: z.array(z.string().uuid()).optional(),
});

export const POST = withErrorHandler(
  withRole(["ADMIN_IT", "BENDAHARA"], async (req, _context, authSession) => {
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

    // 2. Tentukan nominal SPP (peta per siswa atau default override)
    const studentTariffMap = new Map<string, number>();
    let defaultTenantAmount = 450000;

    if (overrideAmount !== undefined && overrideAmount !== null) {
      defaultTenantAmount = overrideAmount;
    } else {
      const activeTariffs = await db
        .select()
        .from(sppTariffs)
        .where(and(eq(sppTariffs.tenantId, tenantId), eq(sppTariffs.isActive, true)));

      for (const tariff of activeTariffs) {
        if (tariff.studentId) {
          studentTariffMap.set(tariff.studentId, tariff.amount);
        } else if (!tariff.grade && !tariff.class) {
          defaultTenantAmount = tariff.amount;
        }
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
      const [existing] = await db
        .select()
        .from(sppInvoices)
        .where(
          and(
            eq(sppInvoices.tenantId, tenantId),
            eq(sppInvoices.studentId, student.id),
            eq(sppInvoices.month, month),
            eq(sppInvoices.year, year)
          )
        )
        .limit(1);

      if (existing) {
        skippedCount++;
        continue;
      }

      const finalAmount = overrideAmount !== undefined && overrideAmount !== null
        ? overrideAmount
        : (studentTariffMap.get(student.id) ?? defaultTenantAmount);

      // Generate invoice number unik: INV-SPP-YYYYMM-[4 digit random]
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-SPP-${year}${formattedMonth}-${randomSuffix}-${student.id.substring(0, 4).toUpperCase()}`;

      await db.insert(sppInvoices).values({
        tenantId,
        studentId: student.id,
        invoiceNumber,
        month,
        year,
        amount: finalAmount,
        dueDate: invoiceDueDate,
        status: "PENDING",
      });

      // Kirim Notifikasi Sistem ke Siswa via Template & Realtime Socket
      const notifData = createSPPPaymentPublishedNotification({
        studentName: student.name,
        month,
        year,
        amount: finalAmount,
        dueDate: invoiceDueDate,
      });

      const [insertedNotif] = await db.insert(notifications).values({
        tenantId,
        userId: student.id,
        title: notifData.title,
        message: notifData.message,
        type: notifData.type,
        link: notifData.link,
        isRead: false,
      }).returning();

      if (insertedNotif) {
        emitToUser(student.id, "notification.created", mapNotificationToResponse(insertedNotif));
      }

      createdCount++;
    }

    await logAudit(
      "PUBLISH_SPP_INVOICES",
      `SPP-${month}-${year}`,
      {
        userId: authSession.user.id,
        userRole: authSession.user.role,
        module: "PAYMENT",
        month,
        year,
        amount: defaultTenantAmount,
        targetType,
        createdCount,
        skippedCount,
      },
      undefined,
      tenantId
    );

    return successResponse({
      message: `Berhasil menerbitkan ${createdCount} invoice SPP. (${skippedCount} siswa disetujui/sudah pernah terbit)`,
      createdCount,
      skippedCount,
      amountUsed: defaultTenantAmount,
    });
  })
);
