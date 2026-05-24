import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq, and } from "drizzle-orm";

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
  withAuth(async (req: NextRequest, context: { params: Record<string, string> }, authSession) => {
    const { id } = context.params;
    const tenantId = authSession.user.tenantId;

    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }

    const conditions = [eq(invoices.id, id), eq(invoices.tenantId, tenantId)];

    // SISWA can only see own invoices
    if (authSession.user.role === "SISWA") {
      conditions.push(eq(invoices.studentId, authSession.user.id));
    }

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(...conditions))
      .limit(1);

    if (!invoice) {
      return errorResponse("Invoice not found", 404);
    }

    return successResponse(mapInvoiceToResponse(invoice), "Invoice retrieved successfully");
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
