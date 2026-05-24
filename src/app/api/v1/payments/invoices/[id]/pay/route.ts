import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withRole } from "@/middleware/rbacMiddleware";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { invoices, payments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { payInvoiceSchema } from "@/validations/payment";
import { emitToTenant } from "@/websocket";

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

export const POST = withErrorHandler(
  withRole(["SISWA", "STAFF", "SUPER_ADMIN", "ADMIN_IT"], async (req: NextRequest, context: { params: Record<string, string> }, authSession) => {
    const { id } = context.params;
    const tenantId = authSession.user.tenantId;

    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }

    const body = await req.json();
    const parsed = payInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Validasi gagal", 400, parsed.error.errors);
    }

    const { paymentMethod } = parsed.data;

    // Check invoice exists and is UNPAID
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
      .limit(1);

    if (!invoice) {
      return errorResponse("Invoice not found", 404);
    }

    if (invoice.status !== "UNPAID") {
      return errorResponse("Invoice is not unpaid", 400);
    }

    // SISWA can only pay own invoices
    if (authSession.user.role === "SISWA" && invoice.studentId !== authSession.user.id) {
      return errorResponse("Forbidden: You can only pay your own invoices", 403);
    }

    try {
      const now = new Date();

      // Create payment record
      const [payment] = await db
        .insert(payments)
        .values({
          tenantId,
          invoiceId: id,
          amount: invoice.amount,
          paymentMethod,
          paidAt: now,
          referenceNumber: crypto.randomUUID(),
        })
        .returning();

      // Update invoice status to PAID
      await db
        .update(invoices)
        .set({ status: "PAID", updatedAt: now })
        .where(eq(invoices.id, id));

      const mapped = mapPaymentToResponse(payment);

      // Emit WebSocket success event
      emitToTenant(tenantId, "payment.success", mapped);

      return successResponse(mapped, "Payment processed successfully", 201);
    } catch (error: any) {
      // Emit WebSocket failure event
      emitToTenant(tenantId, "payment.failed", {
        invoiceId: id,
        message: error.message || "Payment processing failed",
      });

      throw error;
    }
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    },
  });
};
