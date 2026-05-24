import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { successResponse } from "@/utils/apiResponse";
import { parsePaginationParams, buildPaginatedResponse } from "@/utils/pagination";
import { db } from "@/db";
import { payments, invoices } from "@/db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";

function mapPaymentToResponse(p: any) {
  return {
    id: p.id,
    tenantId: p.tenantId,
    invoiceId: p.invoiceId,
    amount: p.amount,
    paymentMethod: p.paymentMethod,
    paidAt: p.paidAt.toISOString(),
    referenceNumber: p.referenceNumber,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const GET = withErrorHandler(
  withAuth(async (req: NextRequest, _context, authSession) => {
    const { page, limit, offset } = parsePaginationParams(req.nextUrl.searchParams);
    const tenantId = authSession.user.tenantId;
    if (!tenantId) {
      return successResponse(null, "Tenant context missing");
    }

    const paymentMethod = req.nextUrl.searchParams.get("paymentMethod");
    const startDate = req.nextUrl.searchParams.get("startDate");
    const endDate = req.nextUrl.searchParams.get("endDate");

    const conditions = [eq(payments.tenantId, tenantId)];

    // SISWA sees only own payments (join via invoices to get studentId)
    if (authSession.user.role === "SISWA") {
      conditions.push(eq(invoices.studentId, authSession.user.id));
    }

    if (paymentMethod) {
      conditions.push(eq(payments.paymentMethod, paymentMethod));
    }

    if (startDate) {
      conditions.push(gte(payments.paidAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(payments.paidAt, new Date(endDate)));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db
        .select({
          id: payments.id,
          tenantId: payments.tenantId,
          invoiceId: payments.invoiceId,
          amount: payments.amount,
          paymentMethod: payments.paymentMethod,
          paidAt: payments.paidAt,
          referenceNumber: payments.referenceNumber,
          createdAt: payments.createdAt,
          updatedAt: payments.updatedAt,
          invoiceNumber: invoices.invoiceNumber,
          description: invoices.description,
          studentId: invoices.studentId,
        })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(whereClause)
        .orderBy(desc(payments.paidAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: payments.id })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(whereClause),
    ]);

    const totalItems = countResult.length;
    const mapped = items.map((item) => ({
      ...mapPaymentToResponse(item),
      invoiceNumber: item.invoiceNumber,
      invoiceDescription: item.description,
      studentId: item.studentId,
    }));
    const paginated = buildPaginatedResponse(mapped, totalItems, page, limit);

    return successResponse(paginated, "Payment history retrieved successfully");
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    },
  });
};
