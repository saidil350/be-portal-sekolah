import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { successResponse } from "@/utils/apiResponse";
import { parsePaginationParams, buildPaginatedResponse } from "@/utils/pagination";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq, and, ilike, desc } from "drizzle-orm";

function mapInvoiceToResponse(inv: any) {
  return {
    id: inv.id,
    tenantId: inv.tenantId,
    invoiceNumber: inv.invoiceNumber,
    studentId: inv.studentId,
    amount: inv.amount,
    dueDate: inv.dueDate.toISOString(),
    status: inv.status,
    description: inv.description,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

export const GET = withErrorHandler(
  withAuth(async (req: NextRequest, _context, authSession) => {
    const { page, limit, offset } = parsePaginationParams(req.nextUrl.searchParams);
    const tenantId = authSession.user.tenantId;
    if (!tenantId) {
      return successResponse(null, "Tenant context missing");
    }

    const studentId = req.nextUrl.searchParams.get("studentId");
    const status = req.nextUrl.searchParams.get("status");
    const search = req.nextUrl.searchParams.get("invoiceNumber");

    const conditions = [eq(invoices.tenantId, tenantId)];

    // SISWA can only see own invoices
    if (authSession.user.role === "SISWA") {
      conditions.push(eq(invoices.studentId, authSession.user.id));
    } else if (studentId) {
      conditions.push(eq(invoices.studentId, studentId));
    }

    if (status) {
      conditions.push(eq(invoices.status, status));
    }

    if (search) {
      conditions.push(ilike(invoices.invoiceNumber, `%${search}%`));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(invoices)
        .where(whereClause)
        .orderBy(desc(invoices.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: invoices.id })
        .from(invoices)
        .where(whereClause),
    ]);

    const totalItems = countResult.length;
    const mapped = items.map(mapInvoiceToResponse);
    const paginated = buildPaginatedResponse(mapped, totalItems, page, limit);

    return successResponse(paginated, "Invoices retrieved successfully");
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
