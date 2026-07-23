import { NextRequest } from "next/server";
import { db } from "@/db";
import { sppInvoices, payments, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getSessionFromRequest } from "@/middleware/auth";
import { headers } from "next/headers";
import { eq, desc, and, sql, ilike } from "drizzle-orm";
import { z } from "zod";
import { errorResponse, successResponse, successResponseNoCache, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

const invoiceQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  status: z.enum(["ALL", "PAID", "UNPAID"]).default("ALL"),
  search: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    let session;
    try {
      session = await getSessionFromRequest(req);
    } catch (err: any) {
      return errorResponse(err.message || "Unauthorized", 401);
    }

    const userId = session.user.id;
    const url = new URL(req.url);
    const query = Object.fromEntries(url.searchParams.entries());

    // Validasi Zod
    const { page, limit, status, search } = invoiceQuerySchema.parse(query);

    const offset = (page - 1) * limit;

    // Build Kondisi (Filter & Search)
    const conditions = [eq(sppInvoices.studentId, userId)];

    if (status === "PAID") {
      conditions.push(eq(sppInvoices.status, "PAID"));
    } else if (status === "UNPAID") {
      conditions.push(eq(sppInvoices.status, "PENDING")); // Di DB tagihan belum lunas statusnya PENDING
    }

    // Gunakan LEFT JOIN agar tidak terjadi N+1 Query
    // Query ini akan mengambil Invoices beserta Payment sukses terakhir jika ada
    const queryBuilder = db
      .select({
        id: sppInvoices.id,
        month: sppInvoices.month,
        year: sppInvoices.year,
        amount: sppInvoices.amount,
        status: sppInvoices.status,
        dueDate: sppInvoices.dueDate,
        updatedAt: sppInvoices.updatedAt,
        paymentMethod: payments.paymentMethod,
      })
      .from(sppInvoices)
      .leftJoin(
        payments,
        and(
          eq(payments.invoiceId, sppInvoices.id),
          eq(payments.status, "PAID")
        )
      )
      .where(and(...conditions))
      .orderBy(desc(sppInvoices.createdAt))
      .limit(limit)
      .offset(offset);

    let fetchedInvoices = await queryBuilder;

    // AUTO-SEED UNTUK TESTING MANUAL KETIKA DATA KOSONG
    if (fetchedInvoices.length === 0 && page === 1 && status === "ALL" && !search) {
      const now = new Date();
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (user) {
        await db.insert(sppInvoices).values([
          {
            tenantId: user.tenantId,
            studentId: userId,
            amount: 350000,
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            status: "PENDING",
            dueDate: new Date(now.getFullYear(), now.getMonth(), 10),
          },
          {
            tenantId: user.tenantId,
            studentId: userId,
            amount: 350000,
            month: now.getMonth() === 0 ? 12 : now.getMonth(),
            year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
            status: "PAID",
            dueDate: new Date(now.getFullYear(), now.getMonth() - 1, 10),
          }
        ]);
        
        // Fetch ulang setelah auto-seed
        fetchedInvoices = await queryBuilder;
      }
    }

    // Mapping ke format response
    const mappedInvoices = fetchedInvoices.map((inv) => ({
      id: inv.id,
      title: `SPP Bulan ${inv.month} Tahun ${inv.year}`,
      month: `${inv.month} ${inv.year}`,
      amount: inv.amount,
      dueDate: inv.dueDate.toISOString().split('T')[0],
      status: inv.status === 'PAID' ? 'PAID' : 'UNPAID',
      paidAt: inv.status === 'PAID' ? inv.updatedAt.toISOString().split('T')[0] : undefined,
      method: inv.paymentMethod || 'Online',
    }));

    // Sederhana count total untuk pagination
    const totalQuery = await db
      .select({ count: sql<number>`count(*)` })
      .from(sppInvoices)
      .where(and(...conditions));
    
    const total = Number(totalQuery[0]?.count || 0);

    return successResponseNoCache({
      items: mappedInvoices,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });

  } catch (error) {
    logger.error({ err: error }, "Error fetching invoices");
    return handleApiError(error);
  }
}
