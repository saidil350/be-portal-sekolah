import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withRole } from "@/middleware/rbacMiddleware";
import { successResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { eq, sql, desc, and, isNull } from "drizzle-orm";

export const GET = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, context, authSession) => {
    const tenantId = authSession.user.tenantId!;

    // We can fetch notifications that are sent by the system or to all users (broadcasts)
    // For simplicity, let's fetch the latest notifications in the tenant
    const recentNotifications = await db
      .select({
        id: notifications.id,
        title: notifications.title,
        message: notifications.message,
        type: notifications.type,
        userId: notifications.userId,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(and(eq(notifications.tenantId, tenantId), isNull(notifications.userId)))
      .orderBy(desc(notifications.createdAt))
      .limit(20);

    const data = recentNotifications.map(n => ({
      title: n.title,
      audience: n.userId ? 'Spesifik User' : 'Semua Pengguna',
      channel: 'In-app',
      sent: n.userId ? '1' : 'Semua',
      status: 'Selesai',
      id: n.id,
      createdAt: n.createdAt
    }));

    const stats = {
      sentToday: data.length, // approximation
      activeTemplates: 6,
      failedSent: 0
    };

    const responseData = {
      stats,
      data
    };

    return successResponse(responseData, "Admin notifications retrieved successfully");
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
