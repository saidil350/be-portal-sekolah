import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { successResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, or, isNull, inArray } from "drizzle-orm";

export const POST = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    const tenantId = authSession.user.tenantId;
    const userId = authSession.user.id;

    let idsToDelete: string[] = [];
    try {
      const body = await req.json();
      if (Array.isArray(body?.ids) && body.ids.length > 0) {
        idsToDelete = body.ids;
      }
    } catch {
      // Body empty or not JSON -> delete all
    }

    const baseWhere = and(
      eq(notifications.tenantId, tenantId!),
      or(
        eq(notifications.userId, userId),
        isNull(notifications.userId)
      )
    );

    if (idsToDelete.length > 0) {
      await db
        .delete(notifications)
        .where(
          and(
            baseWhere,
            inArray(notifications.id, idsToDelete)
          )
        );
      return successResponse({ deletedCount: idsToDelete.length }, "Selected notifications deleted successfully");
    } else {
      await db
        .delete(notifications)
        .where(baseWhere);
      return successResponse(null, "All notifications cleared successfully");
    }
  })
);

export const DELETE = POST;

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.APP_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
      "Access-Control-Allow-Credentials": "true",
    },
  });
};
