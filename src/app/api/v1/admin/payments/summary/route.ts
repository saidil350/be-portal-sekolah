import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { sppInvoices, payments, users, sppTariffs } from "@/db/schema";
import { eq, and, sql, desc, inArray, gte, lte } from "drizzle-orm";

export const GET = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Start of today
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. KPI Aggregations
    // Total Tagihan (Semua invoice) & Total nominal outstanding
    const [invoiceStats] = await db
      .select({
        totalTagihan: sql<number>`COUNT(*)`,
        totalLunas: sql<number>`COUNT(CASE WHEN ${sppInvoices.status} = 'PAID' THEN 1 END)`,
        totalPending: sql<number>`COUNT(CASE WHEN ${sppInvoices.status} = 'PENDING' THEN 1 END)`,
        totalGagal: sql<number>`COUNT(CASE WHEN ${sppInvoices.status} IN ('FAILED', 'EXPIRED', 'CANCELLED') THEN 1 END)`,
        outstandingPayment: sql<number>`COALESCE(SUM(CASE WHEN ${sppInvoices.status} = 'PENDING' THEN ${sppInvoices.amount} ELSE 0 END), 0)`,
      })
      .from(sppInvoices)
      .where(eq(sppInvoices.tenantId, tenantId));

    // Pendapatan Bulan Ini (Invoice PAID di bulan ini)
    const [monthIncome] = await db
      .select({
        amount: sql<number>`COALESCE(SUM(${sppInvoices.amount}), 0)`,
      })
      .from(sppInvoices)
      .where(
        and(
          eq(sppInvoices.tenantId, tenantId),
          eq(sppInvoices.status, "PAID"),
          eq(sppInvoices.month, currentMonth),
          eq(sppInvoices.year, currentYear)
        )
      );

    // Pendapatan Hari Ini (Payments PAID hari ini)
    const [todayIncome] = await db
      .select({
        amount: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.status, "PAID"),
          gte(payments.paidAt, startOfToday)
        )
      );

    const totalTagihanCount = Number(invoiceStats?.totalTagihan || 0);
    const totalLunasCount = Number(invoiceStats?.totalLunas || 0);
    const totalPendingCount = Number(invoiceStats?.totalPending || 0);
    const totalGagalCount = Number(invoiceStats?.totalGagal || 0);
    const outstandingPaymentAmount = Number(invoiceStats?.outstandingPayment || 0);
    const pendapatanBulanIniAmount = Number(monthIncome?.amount || 0);
    const pendapatanHariIniAmount = Number(todayIncome?.amount || 0);

    const successRate = totalTagihanCount > 0 
      ? Math.round((totalLunasCount / totalTagihanCount) * 100) 
      : 0;

    const kpiData = {
      totalTagihan: totalTagihanCount,
      totalLunas: totalLunasCount,
      totalPending: totalPendingCount,
      totalGagal: totalGagalCount,
      pendapatanHariIni: pendapatanHariIniAmount,
      pendapatanBulanIni: pendapatanBulanIniAmount,
      outstandingPayment: outstandingPaymentAmount,
      successRate,
    };

    // 2. Tren Pendapatan Bulanan (6 bulan terakhir)
    const bulanNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
    const pendapatanBulanan: { month: string; amount: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      const [res] = await db
        .select({
          amount: sql<number>`COALESCE(SUM(${sppInvoices.amount}), 0)`,
        })
        .from(sppInvoices)
        .where(
          and(
            eq(sppInvoices.tenantId, tenantId),
            eq(sppInvoices.status, "PAID"),
            eq(sppInvoices.month, m),
            eq(sppInvoices.year, y)
          )
        );

      pendapatanBulanan.push({
        month: `${bulanNames[m - 1]} ${y}`,
        amount: Number(res?.amount || 0),
      });
    }

    // 3. Breakdown Status Pembayaran
    const statusPembayaran = [
      { name: "Lunas", value: totalLunasCount },
      { name: "Pending", value: totalPendingCount },
      { name: "Gagal", value: totalGagalCount },
    ];

    // 4. Breakdown Metode Pembayaran
    let metodePembayaran = [{ name: "LAINNYA", value: 0 }];
    try {
      const paymentMethodsQuery = await db
        .select({
          method: payments.paymentType,
          count: sql<number>`COUNT(*)`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.tenantId, tenantId),
            eq(payments.status, "PAID")
          )
        )
        .groupBy(payments.paymentType);

      metodePembayaran = paymentMethodsQuery.map((pm) => ({
        name: (pm.method || "Lainnya").toUpperCase(),
        value: Number(pm.count || 0),
      }));
    } catch (error) {
      console.warn("Failed to load payment method breakdown for admin dashboard:", error);
    }

    // 5. Tingkat Lunas per Kelas / Tarif
    let pembayaranKelas = [{ grade: "Keseluruhan", rate: successRate }];
    try {
      const gradeStatsQuery = await db
        .select({
          grade: sppTariffs.grade,
          total: sql<number>`COUNT(${sppInvoices.id})`,
          paid: sql<number>`COUNT(CASE WHEN ${sppInvoices.status} = 'PAID' THEN 1 END)`,
        })
        .from(sppInvoices)
        .leftJoin(users, eq(sppInvoices.studentId, users.id))
        .leftJoin(sppTariffs, eq(sppTariffs.studentId, users.id))
        .where(eq(sppInvoices.tenantId, tenantId))
        .groupBy(sppTariffs.grade);

      const mappedGrades = gradeStatsQuery
        .filter((g) => g.grade)
        .map((g) => {
          const tot = Number(g.total || 0);
          const pd = Number(g.paid || 0);
          return {
            grade: `Kelas ${g.grade}`,
            rate: tot > 0 ? Math.round((pd / tot) * 100) : 0,
          };
        });

      if (mappedGrades.length > 0) {
        pembayaranKelas = mappedGrades;
      }
    } catch (error) {
      console.warn("Failed to load class payment breakdown for admin dashboard:", error);
    }

    // 6. Top Outstanding Invoices per Siswa
    let outstandingInvoices: Array<{
      name: string;
      grade: string;
      amount: number;
      months: number;
    }> = [];
    try {
      const outstandingInvoicesQuery = await db
        .select({
          studentId: sppInvoices.studentId,
          studentName: users.name,
          monthsCount: sql<number>`COUNT(${sppInvoices.id})`,
          totalAmount: sql<number>`COALESCE(SUM(${sppInvoices.amount}), 0)`,
        })
        .from(sppInvoices)
        .innerJoin(users, eq(sppInvoices.studentId, users.id))
        .where(
          and(
            eq(sppInvoices.tenantId, tenantId),
            eq(sppInvoices.status, "PENDING")
          )
        )
        .groupBy(sppInvoices.studentId, users.name)
        .orderBy(desc(sql`SUM(${sppInvoices.amount})`))
        .limit(5);

      outstandingInvoices = outstandingInvoicesQuery.map((row) => ({
        name: row.studentName || "Siswa",
        grade: "Siswa",
        amount: Number(row.totalAmount || 0),
        months: Number(row.monthsCount || 0),
      }));
    } catch (error) {
      console.warn("Failed to load outstanding invoices for admin dashboard:", error);
    }

    return successResponse({
      kpiData,
      chartData: {
        pendapatanBulanan,
        statusPembayaran,
        metodePembayaran,
        pembayaranKelas,
      },
      widgetData: {
        outstandingInvoices,
      },
    });
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.APP_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
      "Access-Control-Allow-Credentials": "true",
    },
  });
};
