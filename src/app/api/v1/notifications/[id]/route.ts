import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { successResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { NotFoundError } from "@/utils/AppError";

export const DELETE = withErrorHandler(
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

    await db
      .delete(notifications)
      .where(eq(notifications.id, id));

    return successResponse(
      { id },
      "Notification deleted successfully"
    );
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.APP_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
      "Access-Control-Allow-Credentials": "true",
    },
  });
};
