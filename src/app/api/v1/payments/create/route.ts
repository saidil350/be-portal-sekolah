import { NextRequest } from "next/server";
import { PaymentService } from "@/services/payment.service";
import { auth } from "@/lib/auth";
import { getSessionFromRequest } from "@/middleware/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { errorResponse, successResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

const createPaymentSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID format"),
});

export async function POST(req: NextRequest) {
  try {
    let session;
    try {
      session = await getSessionFromRequest(req);
    } catch (err: any) {
      return errorResponse(err.message || "Unauthorized", 401);
    }

    const body = await req.json();
    
    // Validate with Zod
    const { invoiceId } = createPaymentSchema.parse(body);

    logger.info({ userId: session.user.id, invoiceId }, "Creating payment request");

    const result = await PaymentService.createPayment(invoiceId, session.user.id);

    return successResponse(result);
  } catch (error) {
    logger.error({ err: error }, "Error creating payment");
    return handleApiError(error);
  }
}
