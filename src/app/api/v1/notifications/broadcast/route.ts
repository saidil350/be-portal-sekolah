import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withRole } from "@/middleware/rbacMiddleware";
import { successResponse } from "@/utils/apiResponse";
import { broadcastNotificationSchema } from "@/validations/notification";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { emitToUser, emitToTenant } from "@/websocket";

function mapNotificationToResponse(n: any) {
  return {
    id: n.id,
    tenantId: n.tenantId,
    title: n.title,
    message: n.message,
    type: n.type,
    userId: n.userId,
    isRead: n.isRead,
    readAt: n.readAt?.toISOString() || null,
    link: n.link,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

export const POST = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, context, authSession) => {
    const body = await req.json();
    const parsed = broadcastNotificationSchema.parse(body);

    const tenantId = authSession.user.tenantId!;

    const inserted = await db
      .insert(notifications)
      .values({
        tenantId,
        title: parsed.title,
        message: parsed.message,
        type: parsed.type,
        userId: parsed.userId || null,
        link: parsed.link || null,
      })
      .returning();

    const notification = mapNotificationToResponse(inserted[0]);

    if (parsed.userId) {
      emitToUser(parsed.userId, "notification.created", notification);
      emitToTenant(tenantId, "notification.broadcast", notification);
    } else {
      emitToTenant(tenantId, "notification.broadcast", notification);
    }

    return successResponse(notification, "Notification created successfully", 201);
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
