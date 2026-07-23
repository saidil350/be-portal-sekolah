import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { successResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";

export const POST = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    const tenantId = authSession.user.tenantId;
    const userId = authSession.user.id;

    const now = new Date();

    await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(notifications.tenantId, tenantId!),
          or(
            eq(notifications.userId, userId),
            isNull(notifications.userId)
          ),
          eq(notifications.isRead, false)
        )
      );

    return successResponse(null, "All notifications marked as read");
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
