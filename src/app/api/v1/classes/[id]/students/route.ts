import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { withRole } from "@/middleware/rbacMiddleware";
import { successResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { classes, users, classEnrollments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { assignStudentsSchema } from "@/validations/class";
import { NotFoundError } from "@/utils/AppError";

export const GET = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    const { id } = context.params;
    const tenantId = authSession.user.tenantId;

    // Verify class exists and belongs to tenant
    const [classRecord] = await db
      .select()
      .from(classes)
      .where(and(eq(classes.id, id), eq(classes.tenantId, tenantId!)))
      .limit(1);

    if (!classRecord) {
      throw new NotFoundError("Class not found");
    }

    // Get all students enrolled in this class
    const enrolledStudents = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        avatarUrl: users.image,
        isActive: users.isActive,
        enrollmentStatus: classEnrollments.status,
        enrolledAt: classEnrollments.enrolledAt,
        academicYear: classEnrollments.academicYear,
      })
      .from(classEnrollments)
      .innerJoin(users, eq(classEnrollments.studentId, users.id))
      .where(eq(classEnrollments.classId, id));

    const mapped = enrolledStudents.map((student) => ({
      id: student.id,
      email: student.email,
      name: student.name,
      role: student.role,
      avatarUrl: student.avatarUrl,
      isActive: student.isActive,
      enrollmentStatus: student.enrollmentStatus,
      enrolledAt: student.enrolledAt.toISOString(),
      academicYear: student.academicYear,
    }));

    return successResponse(mapped, "Students retrieved successfully");
  })
);

export const POST = withErrorHandler(
  withRole(["SUPER_ADMIN", "ADMIN_IT", "GURU"], async (req, context, authSession) => {
    const { id } = context.params;
    const tenantId = authSession.user.tenantId;
    const body = await req.json();
    const validated = assignStudentsSchema.parse(body);

    // Verify class exists and belongs to tenant
    const [classRecord] = await db
      .select()
      .from(classes)
      .where(and(eq(classes.id, id), eq(classes.tenantId, tenantId!)))
      .limit(1);

    if (!classRecord) {
      throw new NotFoundError("Class not found");
    }

    // Get existing enrollments for these students in this class
    const existingEnrollments = await db
      .select({ studentId: classEnrollments.studentId })
      .from(classEnrollments)
      .where(eq(classEnrollments.classId, id));

    const existingStudentIds = new Set(
      existingEnrollments.map((e) => e.studentId)
    );

    // Filter out students who are already enrolled
    const newStudentIds = validated.studentIds.filter(
      (studentId) => !existingStudentIds.has(studentId)
    );

    if (newStudentIds.length > 0) {
      const values = newStudentIds.map((studentId) => ({
        classId: id,
        studentId,
        academicYear: classRecord.academicYear,
        status: "active" as const,
      }));

      await db.insert(classEnrollments).values(values);
    }

    return successResponse(
      {
        enrolled: newStudentIds.length,
        skipped: validated.studentIds.length - newStudentIds.length,
      },
      "Students assigned successfully"
    );
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    },
  });
};
