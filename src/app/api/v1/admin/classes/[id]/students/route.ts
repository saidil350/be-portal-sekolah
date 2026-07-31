import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { users, studentProfiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const GET = withErrorHandler(
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

    // 1. Cari siswa yang memang terdaftar di class_id ini
    const studentList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        nis: studentProfiles.nis,
        nisn: studentProfiles.nisn,
      })
      .from(users)
      .innerJoin(studentProfiles, eq(users.id, studentProfiles.userId))
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.role, "SISWA"),
          eq(studentProfiles.classId, classId)
        )
      )
      .execute();

    return successResponse(studentList);
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
