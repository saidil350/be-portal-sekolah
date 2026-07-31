import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withRole } from "@/middleware/rbacMiddleware";
import { successResponse } from "@/utils/apiResponse";
import { broadcastNotificationSchema } from "@/validations/notification";
import { db } from "@/db";
import { notifications, tenants, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { emitToUser, emitToTenant } from "@/websocket";
import { BadRequestError, AppError } from "@/utils/AppError";

function formatDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  try {
    let str = String(val);
    if (!str.endsWith("Z") && !str.includes("+") && !str.includes("Z")) {
      str = str.replace(" ", "T") + "Z";
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d.toISOString();
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
    // Bagi role ADMIN_IT, jika header x-tenant-id dikirim, utamakan header tersebut
    let activeTenantId = (authSession.user.role === "ADMIN_IT" && headerTenantId)
      ? headerTenantId
      : (authSession.user.tenantId || headerTenantId);

    if (!activeTenantId) {
      const firstTenant = await db.select({ id: tenants.id }).from(tenants).limit(1);
      if (firstTenant.length) {
        activeTenantId = firstTenant[0].id;
      } else {
        throw new BadRequestError("Tenant ID tidak ditemukan pada sesi user, header, atau database.");
      }
    }

    // Verifikasi apakah tenantId benar-benar ada di database
    const existingTenant = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, activeTenantId))
      .limit(1);

    if (!existingTenant.length) {
      throw new BadRequestError(`Tenant dengan ID "${activeTenantId}" tidak ditemukan.`);
    }

    // Verifikasi apakah userId ada jika dikirimkan
    if (parsed.userId) {
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, parsed.userId))
        .limit(1);

      if (!existingUser.length) {
        throw new BadRequestError(`User target dengan ID "${parsed.userId}" tidak ditemukan.`);
      }
    }

    // Pastikan field nullable UUID benar-benar undefined (bukan null/empty string)
    // agar Drizzle menggunakan DEFAULT dan PostgreSQL tidak menerima empty string
    const safeUserId = (parsed.userId && parsed.userId.trim().length > 0) ? parsed.userId : undefined;
    const safeTargetRole = (parsed.targetRole && parsed.targetRole.trim().length > 0) ? parsed.targetRole : undefined;
    const safeLink = (parsed.link && parsed.link.trim().length > 0) ? parsed.link : undefined;

    const now = new Date();
    const inserted = await db
      .insert(notifications)
      .values({
        tenantId: activeTenantId,
        title: parsed.title,
        message: parsed.message,
        type: parsed.type,
        userId: safeUserId,
        targetRole: safeTargetRole,
        link: safeLink,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!inserted || !inserted.length) {
      throw new AppError("Gagal menyimpan notifikasi ke database.", 500);
    }

    const notification = mapNotificationToResponse(inserted[0]);

    if (safeUserId) {
      emitToUser(safeUserId, "notification.created", notification);
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
