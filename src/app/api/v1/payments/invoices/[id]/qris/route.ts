import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const GET = withErrorHandler(
  withAuth(async (req: NextRequest, context: { params: Record<string, string> }, authSession) => {
    const { id } = context.params;
    const tenantId = authSession.user.tenantId;

    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }

    // Check invoice exists and is UNPAID
    const conditions = [eq(invoices.id, id), eq(invoices.tenantId, tenantId)];

    // SISWA can only access own invoices
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

    if (invoice.status !== "UNPAID") {
      return errorResponse("Invoice is not unpaid", 400);
    }

    // Generate mock QRIS data (Midtrans integration is placeholder)
    const qrisData = {
      qrCodeString: `QRIS-${invoice.invoiceNumber}-${Date.now()}`,
      invoiceId: invoice.id,
      amount: invoice.amount,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
    };

    return successResponse(qrisData, "QRIS data generated successfully");
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
