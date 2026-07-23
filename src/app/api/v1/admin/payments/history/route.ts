import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { payments, sppInvoices, users } from "@/db/schema";
import { eq, desc, and, ilike, sql, gte, lte } from "drizzle-orm";
import { z } from "zod";

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.string().optional(),
  method: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const GET = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) return errorResponse("Tenant context missing", 400);

    const url = new URL(req.url);
    const query = Object.fromEntries(url.searchParams.entries());
    const parsedQuery = querySchema.safeParse(query);

    if (!parsedQuery.success) {
      return errorResponse("Invalid query parameters", 400, parsedQuery.error.errors);
    }

    const { page, limit, search, status, method, startDate, endDate } = parsedQuery.data;
    const offset = (page - 1) * limit;

    const conditions = [eq(payments.tenantId, tenantId)];
    
    if (search) {
      conditions.push(
        sql`(${users.name} ILIKE ${'%' + search + '%'} OR ${payments.orderId} ILIKE ${'%' + search + '%'} OR ${sppInvoices.invoiceNumber} ILIKE ${'%' + search + '%'})`
      );
    }
    if (status && status !== 'all') {
      conditions.push(eq(payments.status, status as any));
    }
    if (method && method !== 'all') {
      conditions.push(eq(payments.paymentMethod, method));
    }
    if (startDate) {
      conditions.push(gte(payments.createdAt, new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(payments.createdAt, end));
    }

    const whereClause = and(...conditions);

    // Get Data
    const dataQuery = db.select({
      id: payments.id,
      orderId: payments.orderId,
      paymentNumber: payments.paymentNumber,
      amount: payments.amount,
      paymentMethod: payments.paymentMethod,
      paymentType: payments.paymentType,
      status: payments.status,
      midtransTransactionId: payments.midtransTransactionId,
      paidAt: payments.paidAt,
      createdAt: payments.createdAt,
      invoiceNumber: sppInvoices.invoiceNumber,
      invoiceMonth: sppInvoices.month,
      invoiceYear: sppInvoices.year,
      studentName: users.name,
      studentId: users.id,
    })
    .from(payments)
    .innerJoin(sppInvoices, eq(payments.invoiceId, sppInvoices.id))
    .innerJoin(users, eq(sppInvoices.studentId, users.id))
    .where(whereClause)
    .orderBy(desc(payments.createdAt))
    .limit(limit)
    .offset(offset);

    // Get Total Count
    const countQuery = db.select({ count: sql<number>`count(*)` })
    .from(payments)
    .innerJoin(sppInvoices, eq(payments.invoiceId, sppInvoices.id))
    .innerJoin(users, eq(sppInvoices.studentId, users.id))
    .where(whereClause);

    const [data, totalCount] = await Promise.all([
      dataQuery,
      countQuery
    ]);

    const total = Number(totalCount[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    return successResponse({
      data,
      meta: {
        page,
        limit,
        total,
        totalPages
      }
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
