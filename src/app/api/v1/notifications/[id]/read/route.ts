import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { successResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { NotFoundError } from "@/utils/AppError";

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
  withAuth(async (req, context, authSession) => {
    const { id } = await context.params;
    const tenantId = authSession.user.tenantId;
    const userId = authSession.user.id;

    const existing = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.tenantId, tenantId!),
          or(
            eq(notifications.userId, userId),
            isNull(notifications.userId)
          )
        )
      )
      .limit(1);

    if (!existing.length) {
      throw new NotFoundError("Notification not found");
    }

    const now = new Date();
    const updated = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: now,
        updatedAt: now,
      })
      .where(eq(notifications.id, id))
      .returning();

    return successResponse(
      mapNotificationToResponse(updated[0]),
      "Notification marked as read"
    );
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
