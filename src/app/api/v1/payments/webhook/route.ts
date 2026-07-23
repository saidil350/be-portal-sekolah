import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/services/payment.service";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const notification = await req.json();
    logger.info({ order_id: notification.order_id }, "Received webhook notification");
    
    await PaymentService.handleWebhook(notification);
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    logger.error({ err: error }, "Webhook error");
    
    // Midtrans membutuhkan respons 200 walau error agar tidak spam jika error-nya konstan (seperti invalid signature/amount)
    return NextResponse.json(
      { success: false, error: { message: error.message || "Failed to process webhook" } },
      { status: 200 }
    );
  }
}
