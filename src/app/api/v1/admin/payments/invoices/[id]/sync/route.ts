import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { PaymentService } from "@/services/payment.service";

export const POST = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, { params }, authSession) => {
    // Await params to avoid Next.js warnings/errors in newer Next versions
    const resolvedParams = await params;
    const invoiceId = resolvedParams.id;

    if (!invoiceId) {
      return errorResponse("Invoice ID is required", 400);
    }

    try {
      const result = await PaymentService.syncPayment(invoiceId);
      return successResponse(result);
    } catch (error: any) {
      return errorResponse(error.message || "Failed to sync payment status with Midtrans", 500);
    }
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.APP_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
      "Access-Control-Allow-Credentials": "true",
    },
  });
};
