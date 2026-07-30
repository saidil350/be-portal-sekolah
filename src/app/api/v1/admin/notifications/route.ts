import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withRole } from "@/middleware/rbacMiddleware";
import { successResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { eq, sql, desc, and, isNull } from "drizzle-orm";

function getAudienceLabel(userId: string | null, targetRole: string | null) {
  if (userId) return "Spesifik User";
  if (!targetRole || targetRole === "ALL") return "Semua Pengguna";
  switch (targetRole) {
    case "SISWA": return "Siswa";
    case "GURU": return "Guru";
    case "STAFF": return "Staff";
    case "KEPALA_SEKOLAH": return "Kepala Sekolah";
    case "ADMIN_IT": return "Admin IT";
    default: return targetRole;
  }
}

export const GET = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, context, authSession) => {
    const headerTenantId = req.headers.get("x-tenant-id");
    const tenantId = authSession.user.tenantId || headerTenantId;

    if (!tenantId) {
      return successResponse(
        { stats: { sentToday: 0, activeTemplates: 6, failedSent: 0 }, data: [] },
        "Admin notifications retrieved successfully"
      );
    }

    const recentNotifications = await db
      .select({
        id: notifications.id,
        title: notifications.title,
        message: notifications.message,
        type: notifications.type,
        userId: notifications.userId,
        targetRole: notifications.targetRole,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(and(eq(notifications.tenantId, tenantId), isNull(notifications.userId)))
      .orderBy(desc(notifications.createdAt))
      .limit(20);

    const data = recentNotifications.map(n => ({
      title: n.title,
      audience: getAudienceLabel(n.userId, n.targetRole),
      channel: 'In-app',
      sent: n.userId ? '1' : getAudienceLabel(n.userId, n.targetRole),
      status: 'Selesai',
      id: n.id,
      targetRole: n.targetRole || 'ALL',
      createdAt: n.createdAt
    }));

    const stats = {
      sentToday: data.length,
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
