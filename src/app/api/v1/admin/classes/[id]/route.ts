import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { classes } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const PUT = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, { params }, authSession) => {
    const resolvedParams = await params;
    const classId = resolvedParams.id;
    const tenantId = authSession.user.tenantId;

    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }
    if (!classId) {
      return errorResponse("Class ID is required", 400);
    }

    const body = await req.json();
    const { name, program, homeroomTeacherId, isActive } = body;

    const updated = await db
      .update(classes)
      .set({
        name,
        program: program !== undefined ? program : undefined,
        homeroomTeacherId: homeroomTeacherId !== undefined ? homeroomTeacherId : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(classes.id, classId), eq(classes.tenantId, tenantId)))
      .returning()
      .execute();

    if (updated.length === 0) {
      return errorResponse("Kelas tidak ditemukan atau tidak berwenang", 404);
    }

    return successResponse(updated[0]);
  })
);

export const DELETE = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, { params }, authSession) => {
    const resolvedParams = await params;
    const classId = resolvedParams.id;
    const tenantId = authSession.user.tenantId;

    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }
    if (!classId) {
      return errorResponse("Class ID is required", 400);
    }

    const deleted = await db
      .delete(classes)
      .where(and(eq(classes.id, classId), eq(classes.tenantId, tenantId)))
      .returning()
      .execute();

    if (deleted.length === 0) {
      return errorResponse("Kelas tidak ditemukan atau tidak berwenang", 404);
    }

    return successResponse({ success: true, message: "Kelas berhasil dihapus" });
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.APP_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
      "Access-Control-Allow-Credentials": "true",
    },
  });
};
