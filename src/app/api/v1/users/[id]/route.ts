import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse } from "@/utils/apiResponse";
import { withAuth } from "@/middleware/auth";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { users, studentProfiles, teacherProfiles, studentClassHistory, classes, academicYears } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { updateUserSchema } from "@/validations/user";
import { NotFoundError, ForbiddenError } from "@/utils/AppError";

async function fetchFullUserData(user: typeof users.$inferSelect) {
  let studentProfile = null;
  let teacherProfile = null;
  let currentClass = null;
  let academicHistory: any[] = [];

  if (user.role === "SISWA") {
    studentProfile = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.userId, user.id),
    });

    if (studentProfile?.classId) {
      currentClass = await db.query.classes.findFirst({
        where: eq(classes.id, studentProfile.classId),
      });
    }

    try {
      const historyRows = await db
        .select({
          id: studentClassHistory.id,
          academicYear: academicYears.name,
          semester: academicYears.semester,
          className: classes.name,
          level: classes.level,
          status: studentClassHistory.status,
          createdAt: studentClassHistory.createdAt,
        })
        .from(studentClassHistory)
        .leftJoin(classes, eq(studentClassHistory.classId, classes.id))
        .leftJoin(academicYears, eq(studentClassHistory.academicYearId, academicYears.id))
        .where(eq(studentClassHistory.studentId, user.id))
        .orderBy(desc(studentClassHistory.createdAt));

      academicHistory = historyRows.map((h, idx) => ({
        academicYear: h.academicYear || "2025/2026",
        grade: h.level ? `Kelas ${h.level}` : "Kelas",
        className: h.className || "Kelas",
        semester: `Semester ${h.semester || 1}`,
        status: h.status === "PROMOTED" ? "Naik Kelas" : h.status === "GRADUATED" ? "Lulus" : "Tinggal Kelas",
        isCurrent: idx === 0,
      }));
    } catch (err) {
      console.warn("Notice: student_class_history query error:", err);
      academicHistory = [];
    }
  } else if (user.role === "GURU") {
    teacherProfile = await db.query.teacherProfiles.findFirst({
      where: eq(teacherProfiles.userId, user.id),
    });
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    avatarUrl: user.image,
    phone: user.phone,
    address: user.address,
    isActive: user.isActive,
    studentProfile,
    teacherProfile,
    currentClass,
    academicHistory,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

// GET /api/v1/users/[id] — Get user by ID
export const GET = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    const { id } = await context.params;

    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Tenant scoping: non-ADMIN_IT can only view users in same tenant
    if (
      authSession.user.role !== "ADMIN_IT" &&
      user.tenantId !== authSession.user.tenantId
    ) {
      throw new ForbiddenError("You do not have access to this user");
    }

    const fullData = await fetchFullUserData(user);
    return successResponse(fullData, "User retrieved successfully");
  })
);

// PATCH /api/v1/users/[id] — Update user by ID
export const PATCH = withErrorHandler(
  withRole(["ADMIN_IT", "ADMIN_SEKOLAH", "KEPALA_SEKOLAH"], async (req, context, authSession) => {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = updateUserSchema.parse(body);

    // Fetch existing user
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      throw new NotFoundError("User not found");
    }

    // Tenant scoping: non-ADMIN_IT can only update users in same tenant
    if (
      authSession.user.role !== "ADMIN_IT" &&
      existingUser.tenantId !== authSession.user.tenantId
    ) {
      throw new ForbiddenError("You do not have access to update this user");
    }

    // Protection: Non-ADMIN_IT cannot deactivate ADMIN_IT or ADMIN_SEKOLAH accounts
    if (authSession.user.role !== "ADMIN_IT") {
      if (existingUser.role === "ADMIN_IT" || existingUser.role === "ADMIN_SEKOLAH") {
        throw new ForbiddenError("Anda tidak memiliki izin untuk mengelola akun administrator lain");
      }
    }

    // Hindari menonaktifkan akun sendiri
    if (parsed.isActive === false && existingUser.id === authSession.user.id) {
      throw new ForbiddenError("Anda tidak dapat menonaktifkan akun Anda sendiri");
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (parsed.name !== undefined) {
      updateData.name = parsed.name;
    }
    if (parsed.email !== undefined) {
      updateData.email = parsed.email;
    }
    if (parsed.role !== undefined) {
      updateData.role = parsed.role;
    }
    if (parsed.isActive !== undefined) {
      updateData.isActive = parsed.isActive;
    }
    if (parsed.image !== undefined) {
      updateData.image = parsed.image;
    }

    // Update the user
    await db.update(users).set(updateData).where(eq(users.id, id));

    // Handle student profile updates (e.g. NISN) if applicable
    if (parsed.nisn !== undefined && existingUser.role === "SISWA") {
      const existingProfile = await db.query.studentProfiles.findFirst({
        where: eq(studentProfiles.userId, id),
      });

      if (existingProfile) {
        await db
          .update(studentProfiles)
          .set({
            nisn: parsed.nisn,
            updatedAt: new Date(),
          })
          .where(eq(studentProfiles.userId, id));
      } else {
        await db.insert(studentProfiles).values({
          userId: id,
          tenantId: existingUser.tenantId,
          nis: parsed.nisn || "00000",
          nisn: parsed.nisn,
          gender: "L",
        });
      }
    }

    // Fetch the updated user
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!updatedUser) {
      throw new NotFoundError("User not found after update");
    }

    const fullData = await fetchFullUserData(updatedUser);
    return successResponse(
      fullData,
      "User updated successfully"
    );
  })
);

// DELETE /api/v1/users/[id] — Soft delete user (set isActive = false)
export const DELETE = withErrorHandler(
  withRole(["ADMIN_IT", "ADMIN_SEKOLAH", "KEPALA_SEKOLAH"], async (req, context, authSession) => {
    const { id } = await context.params;

    // Fetch existing user
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      throw new NotFoundError("User not found");
    }

    // Tenant scoping: non-ADMIN_IT can only delete users in same tenant
    if (
      authSession.user.role !== "ADMIN_IT" &&
      existingUser.tenantId !== authSession.user.tenantId
    ) {
      throw new ForbiddenError("You do not have access to delete this user");
    }

    if (existingUser.id === authSession.user.id) {
      throw new ForbiddenError("Anda tidak dapat menonaktifkan akun Anda sendiri");
    }

    // Soft delete: set isActive to false
    await db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return successResponse(null, "User deactivated successfully");
  })
);

// OPTIONS handler for CORS
export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    },
  });
};
