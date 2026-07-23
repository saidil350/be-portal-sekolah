import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { sppInvoices, sppTariffs, users } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit-logger";

const generateSchema = z.object({
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2020).max(2100).optional(),
  dueDate: z.string().optional(),
  defaultAmount: z.number().min(1000).optional().default(250000),
});

export const POST = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = generateSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse("Invalid payload parameters", 400, parseResult.error.errors);
    }

    const currentDate = new Date();
    const targetMonth = parseResult.data.month ?? (currentDate.getMonth() + 1);
    const targetYear = parseResult.data.year ?? currentDate.getFullYear();
    const defaultAmount = parseResult.data.defaultAmount;

    // Tentukan due date (default tanggal 10 pada bulan & tahun target)
    let dueDate: Date;
    if (parseResult.data.dueDate) {
      dueDate = new Date(parseResult.data.dueDate);
    } else {
      dueDate = new Date(targetYear, targetMonth - 1, 10, 23, 59, 59);
    }

    // 1. Ambil seluruh siswa aktif di tenant ini
    const activeStudents = await db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.role, "SISWA"),
          eq(users.isActive, true)
        )
      );

    if (activeStudents.length === 0) {
      return successResponse({
        month: targetMonth,
        year: targetYear,
        totalStudents: 0,
        generatedCount: 0,
        skippedCount: 0,
        message: "Tidak ada siswa aktif ditemukan di tenant ini.",
      });
    }

    const studentIds = activeStudents.map((s) => s.id);

    // 2. Ambil invoice yang SUDAH ada untuk bulan & tahun target
    const existingInvoices = await db
      .select({
        studentId: sppInvoices.studentId,
      })
      .from(sppInvoices)
      .where(
        and(
          eq(sppInvoices.tenantId, tenantId),
          eq(sppInvoices.month, targetMonth),
          eq(sppInvoices.year, targetYear),
          inArray(sppInvoices.studentId, studentIds)
        )
      );

    const existingStudentSet = new Set(existingInvoices.map((inv) => inv.studentId));

    // 3. Ambil tarif SPP khusus / umum di tenant ini
    const tariffs = await db
      .select()
      .from(sppTariffs)
      .where(
        and(
          eq(sppTariffs.tenantId, tenantId),
          eq(sppTariffs.isActive, true)
        )
      );

    // Peta tarif khusus per siswa atau tarif default tenant
    const studentTariffMap = new Map<string, number>();
    let defaultTenantTariff = defaultAmount;

    for (const tariff of tariffs) {
      if (tariff.studentId) {
        studentTariffMap.set(tariff.studentId, tariff.amount);
      } else if (!tariff.grade && !tariff.class) {
        defaultTenantTariff = tariff.amount;
      }
    }

    // 4. Siapkan invoice baru yang perlu disisipkan
    const invoicesToInsert: Array<typeof sppInvoices.$inferInsert> = [];
    const monthStr = String(targetMonth).padStart(2, "0");

    for (const student of activeStudents) {
      if (existingStudentSet.has(student.id)) {
        continue; // Skip jika invoice bulan ini sudah dibuat sebelumnya
      }

      const amount = studentTariffMap.get(student.id) ?? defaultTenantTariff;
      const randomShort = Math.random().toString(36).substring(2, 7).toUpperCase();
      const invoiceNumber = `INV/${targetYear}${monthStr}/${randomShort}`;

      invoicesToInsert.push({
        tenantId,
        studentId: student.id,
        invoiceNumber,
        amount,
        month: targetMonth,
        year: targetYear,
        status: "PENDING",
        dueDate,
      });
    }

    let generatedCount = 0;
    if (invoicesToInsert.length > 0) {
      const inserted = await db.insert(sppInvoices).values(invoicesToInsert).returning({ id: sppInvoices.id });
      generatedCount = inserted.length;
    }

    const skippedCount = activeStudents.length - generatedCount;

    await logAudit(
      "INVOICES_BULK_GENERATED",
      `SPP-${targetMonth}-${targetYear}`,
      {
        month: targetMonth,
        year: targetYear,
        generatedCount,
        skippedCount,
        totalStudents: activeStudents.length,
      },
      undefined,
      tenantId
    );

    return successResponse({
      month: targetMonth,
      year: targetYear,
      totalStudents: activeStudents.length,
      generatedCount,
      skippedCount,
      message: `Berhasil menerbitkan ${generatedCount} tagihan SPP untuk Bulan ${targetMonth} Tahun ${targetYear}. (${skippedCount} di-skip karena sudah ada)`,
    });
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.APP_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    },
  });
};
