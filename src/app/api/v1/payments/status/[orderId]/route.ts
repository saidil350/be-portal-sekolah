import { NextRequest } from "next/server";
import { PaymentService } from "@/services/payment.service";
import { getSessionFromRequest } from "@/middleware/auth";
import { errorResponse, successResponse, successResponseNoCache, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

/**
 * GET /api/v1/payments/status/:orderId
 * Cek status pembayaran langsung ke server Midtrans dan sinkronkan ke DB.
 * Dipakai frontend untuk polling setelah QRIS dibayar (jalur on-demand, andal walau webhook tidak sampai).
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    let session;
    try {
      session = await getSessionFromRequest(req);
    } catch (err: any) {
      return errorResponse(err.message || "Unauthorized", 401);
    }

    const { orderId } = await context.params;

    if (!orderId) {
      return errorResponse("Order ID wajib diisi", 400);
    }

    const result = await PaymentService.checkStatus(orderId, session.user.id);
    
    console.log(`[RUNTIME DEBUG] Endpoint /payments/status/${orderId} mengirim HTTP Response:`, JSON.stringify(result));
    return successResponseNoCache(result);
  } catch (error: any) {
    logger.error({ err: error }, "Error checking payment status");

    if (error.message === "Payment record not found") {
      return errorResponse("Pembayaran tidak ditemukan", 404);
    }
    if (error.message === "Anda tidak berhak mengakses pembayaran ini") {
      return errorResponse(error.message, 403);
    }
    return handleApiError(error);
  }
}
