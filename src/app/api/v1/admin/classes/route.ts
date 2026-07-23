import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { classes, users } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

export const GET = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }

    const list = await db
      .select({
        id: classes.id,
        name: classes.name,
        program: classes.program,
        isActive: classes.isActive,
        level: classes.level,
        homeroomTeacherId: classes.homeroomTeacherId,
        homeroomTeacherName: users.name,
      })
      .from(classes)
      .leftJoin(users, eq(classes.homeroomTeacherId, users.id))
      .where(eq(classes.tenantId, tenantId))
      .orderBy(asc(classes.level))
      .execute();

    return successResponse(list);
  })
);

export const POST = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }

    const body = await req.json();
    const { name, program, homeroomTeacherId, level, isActive } = body;

    if (!name || !name.trim()) {
      return errorResponse("Nama kelas wajib diisi", 400);
    }

    const parsedLevel = level !== undefined && !isNaN(parseInt(level, 10)) ? parseInt(level, 10) : 1;

    const newClass = await db
      .insert(classes)
      .values({
        tenantId,
        name: name.trim(),
        level: parsedLevel,
        program: program || null,
        homeroomTeacherId: homeroomTeacherId || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      })
      .returning()
      .execute();

    return successResponse(newClass[0]);
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.APP_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
      "Access-Control-Allow-Credentials": "true",
    },
  });
};
