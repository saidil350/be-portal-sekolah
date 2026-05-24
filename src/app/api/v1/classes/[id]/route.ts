import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { withRole } from "@/middleware/rbacMiddleware";
import { successResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { classes, classEnrollments } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { updateClassSchema } from "@/validations/class";
import { NotFoundError } from "@/utils/AppError";

function mapClassToResponse(cls: any, studentCount: number = 0) {
  return {
    id: cls.id,
    tenantId: cls.tenantId,
    name: cls.name,
    code: cls.code,
    gradeLevel: cls.gradeLevel,
    homeroomTeacherId: cls.homeroomTeacherId,
    academicYear: cls.academicYear,
    studentCount,
    createdAt: cls.createdAt.toISOString(),
    updatedAt: cls.updatedAt.toISOString(),
  };
}

export const GET = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    const { id } = context.params;
    const tenantId = authSession.user.tenantId;

    const [classRecord] = await db
      .select()
      .from(classes)
      .where(and(eq(classes.id, id), eq(classes.tenantId, tenantId!)))
      .limit(1);

    if (!classRecord) {
      throw new NotFoundError("Class not found");
    }

    // Get student count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(classEnrollments)
      .where(
        and(
          eq(classEnrollments.classId, id),
          eq(classEnrollments.status, "active")
        )
      );

    const studentCount = countResult[0]?.count || 0;

    return successResponse(
      mapClassToResponse(classRecord, studentCount),
      "Class retrieved successfully"
    );
  })
);

export const PATCH = withErrorHandler(
  withRole(["SUPER_ADMIN", "ADMIN_IT", "GURU"], async (req, context, authSession) => {
    const { id } = context.params;
    const tenantId = authSession.user.tenantId;
    const body = await req.json();
    const validated = updateClassSchema.parse(body);

    // Verify class exists and belongs to tenant
    const [existing] = await db
      .select()
      .from(classes)
      .where(and(eq(classes.id, id), eq(classes.tenantId, tenantId!)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Class not found");
    }

    const [updated] = await db
      .update(classes)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(classes.id, id))
      .returning();

    // Get student count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(classEnrollments)
      .where(
        and(
          eq(classEnrollments.classId, id),
          eq(classEnrollments.status, "active")
        )
      );

    const studentCount = countResult[0]?.count || 0;

    return successResponse(
      mapClassToResponse(updated, studentCount),
      "Class updated successfully"
    );
  })
);

export const DELETE = withErrorHandler(
  withRole(["SUPER_ADMIN", "ADMIN_IT"], async (req, context, authSession) => {
    const { id } = context.params;
    const tenantId = authSession.user.tenantId;

    // Verify class exists and belongs to tenant
    const [existing] = await db
      .select()
      .from(classes)
      .where(and(eq(classes.id, id), eq(classes.tenantId, tenantId!)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Class not found");
    }

    await db.delete(classes).where(eq(classes.id, id));

    return successResponse(null, "Class deleted successfully");
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    },
  });
};
