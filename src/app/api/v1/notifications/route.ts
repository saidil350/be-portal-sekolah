import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { successResponse } from "@/utils/apiResponse";
import { parsePaginationParams, buildPaginatedResponse } from "@/utils/pagination";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, or, isNull, desc, sql } from "drizzle-orm";

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

export const GET = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    const { searchParams } = new URL(req.url);
    const { page, limit, offset } = parsePaginationParams(searchParams);

    const tenantId = authSession.user.tenantId;
    const userId = authSession.user.id;

    const isReadFilter = searchParams.get("isRead");
    const typeFilter = searchParams.get("type");

    const conditions = [
      eq(notifications.tenantId, tenantId!),
      or(
        eq(notifications.userId, userId),
        isNull(notifications.userId)
      ),
    ];

    if (isReadFilter !== null) {
      const isRead = isReadFilter === "true";
      conditions.push(eq(notifications.isRead, isRead));
    }

    if (typeFilter) {
      conditions.push(eq(notifications.type, typeFilter));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(notifications)
        .where(whereClause)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(whereClause),
    ]);

    const totalItems = countResult[0].count;
    const paginated = buildPaginatedResponse(
      items.map(mapNotificationToResponse),
      totalItems,
      page,
      limit
    );

    return successResponse(paginated, "Notifications retrieved successfully");
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.APP_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
      "Access-Control-Allow-Credentials": "true",
    },
  });
};
