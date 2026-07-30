import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withRole } from "@/middleware/rbacMiddleware";
import { successResponse } from "@/utils/apiResponse";
import { broadcastNotificationSchema } from "@/validations/notification";
import { db } from "@/db";
import { notifications, tenants } from "@/db/schema";
import { emitToUser, emitToTenant } from "@/websocket";
import { BadRequestError, AppError } from "@/utils/AppError";

function formatDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  try {
    return new Date(val).toISOString();
  } catch {
    return null;
  }
}

function mapNotificationToResponse(n: any) {
  return {
    id: n.id,
    tenantId: n.tenantId,
    title: n.title,
    message: n.message,
    type: n.type,
    userId: n.userId,
    targetRole: n.targetRole || null,
    isRead: n.isRead,
    readAt: formatDate(n.readAt),
    link: n.link,
    createdAt: formatDate(n.createdAt) || new Date().toISOString(),
    updatedAt: formatDate(n.updatedAt) || new Date().toISOString(),
  };
}

export const POST = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, context, authSession) => {
    const body = await req.json();
    const parsed = broadcastNotificationSchema.parse(body);

    const headerTenantId = req.headers.get("x-tenant-id");
    let activeTenantId = authSession.user.tenantId || headerTenantId;

    if (!activeTenantId) {
      const firstTenant = await db.select({ id: tenants.id }).from(tenants).limit(1);
      if (firstTenant.length) {
        activeTenantId = firstTenant[0].id;
      } else {
        throw new BadRequestError("Tenant ID tidak ditemukan pada sesi user, header, atau database.");
      }
    }

    const inserted = await db
      .insert(notifications)
      .values({
        tenantId: activeTenantId,
        title: parsed.title,
        message: parsed.message,
        type: parsed.type,
        userId: parsed.userId || null,
        targetRole: parsed.targetRole || null,
        link: parsed.link || null,
      })
      .returning();

    if (!inserted || !inserted.length) {
      throw new AppError("Gagal menyimpan notifikasi ke database.", 500);
    }

    const notification = mapNotificationToResponse(inserted[0]);

    if (parsed.userId) {
      emitToUser(parsed.userId, "notification.created", notification);
      emitToTenant(activeTenantId, "notification.broadcast", notification);
    } else {
      emitToTenant(activeTenantId, "notification.broadcast", notification);
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
