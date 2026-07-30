import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse } from "@/utils/apiResponse";
import { withAuth } from "@/middleware/auth";
import { db } from "@/db";
import { users, studentProfiles, teacherProfiles, studentClassHistory, classes, academicYears } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { updateProfileSchema } from "@/validations/profile";
import { NotFoundError } from "@/utils/AppError";

// GET /api/v1/profile — Fetch current authenticated user's full profile
export const GET = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    const userId = authSession.user.id;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundError("Pengguna tidak ditemukan");
    }

    let studentProfile = null;
    let teacherProfile = null;
    let currentClass = null;
    let academicHistory: any[] = [];

    if (user.role === "SISWA") {
      studentProfile = await db.query.studentProfiles.findFirst({
        where: eq(studentProfiles.userId, userId),
      });

      if (studentProfile?.classId) {
        currentClass = await db.query.classes.findFirst({
          where: eq(classes.id, studentProfile.classId),
        });
      }

      // Ambil riwayat kenaikan kelas dari tabel student_class_history
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
          .where(eq(studentClassHistory.studentId, userId))
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
        console.warn("Notice: student_class_history table missing or query error:", err);
        academicHistory = [];
      }
    } else if (user.role === "GURU") {
      teacherProfile = await db.query.teacherProfiles.findFirst({
        where: eq(teacherProfiles.userId, userId),
      });
    }

    const profileData = {
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

    return successResponse(profileData, "Profil berhasil diambil");
  })
);

// PATCH /api/v1/profile — Update current authenticated user's profile
export const PATCH = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    const userId = authSession.user.id;
    const body = await req.json();
    const parsed = updateProfileSchema.parse(body);

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundError("Pengguna tidak ditemukan");
    }

    // Update users table (name, image/avatar, phone, address)
    const userUpdate: Record<string, any> = { updatedAt: new Date() };
    if (parsed.name !== undefined) userUpdate.name = parsed.name;
    if (parsed.image !== undefined) userUpdate.image = parsed.image;
    if (parsed.phone !== undefined) userUpdate.phone = parsed.phone;
    if (parsed.address !== undefined) userUpdate.address = parsed.address;

    if (Object.keys(userUpdate).length > 1) {
      await db.update(users).set(userUpdate).where(eq(users.id, userId));
    }

    // Update role specific profiles
    if (user.role === "SISWA") {
      const studentUpdate: Record<string, any> = { updatedAt: new Date() };
      if (parsed.gender !== undefined) studentUpdate.gender = parsed.gender;
      if (parsed.birthPlace !== undefined) studentUpdate.birthPlace = parsed.birthPlace;
      if (parsed.birthDate !== undefined) studentUpdate.birthDate = parsed.birthDate;
      if (parsed.nik !== undefined) studentUpdate.nik = parsed.nik;
      if (parsed.religion !== undefined) studentUpdate.religion = parsed.religion;
      if (parsed.fatherName !== undefined) studentUpdate.fatherName = parsed.fatherName;
      if (parsed.fatherOccupation !== undefined) studentUpdate.fatherOccupation = parsed.fatherOccupation;
      if (parsed.motherName !== undefined) studentUpdate.motherName = parsed.motherName;
      if (parsed.motherOccupation !== undefined) studentUpdate.motherOccupation = parsed.motherOccupation;
      if (parsed.guardianName !== undefined) studentUpdate.guardianName = parsed.guardianName;
      if (parsed.guardianPhone !== undefined) studentUpdate.guardianPhone = parsed.guardianPhone;

      if (Object.keys(studentUpdate).length > 1) {
        const existing = await db.query.studentProfiles.findFirst({
          where: eq(studentProfiles.userId, userId),
        });

        if (existing) {
          await db
            .update(studentProfiles)
            .set(studentUpdate)
            .where(eq(studentProfiles.userId, userId));
        }
      }
    } else if (user.role === "GURU") {
      const teacherUpdate: Record<string, any> = { updatedAt: new Date() };
      if (parsed.gender !== undefined) teacherUpdate.gender = parsed.gender;

      if (Object.keys(teacherUpdate).length > 1) {
        const existing = await db.query.teacherProfiles.findFirst({
          where: eq(teacherProfiles.userId, userId),
        });

        if (existing) {
          await db
            .update(teacherProfiles)
            .set(teacherUpdate)
            .where(eq(teacherProfiles.userId, userId));
        }
      }
    }

    // Return updated full profile
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    let studentProfile = null;
    let teacherProfile = null;

    if (updatedUser?.role === "SISWA") {
      studentProfile = await db.query.studentProfiles.findFirst({
        where: eq(studentProfiles.userId, userId),
      });
    } else if (updatedUser?.role === "GURU") {
      teacherProfile = await db.query.teacherProfiles.findFirst({
        where: eq(teacherProfiles.userId, userId),
      });
    }

    const responseData = {
      id: updatedUser!.id,
      email: updatedUser!.email,
      name: updatedUser!.name,
      role: updatedUser!.role,
      tenantId: updatedUser!.tenantId,
      avatarUrl: updatedUser!.image,
      phone: updatedUser!.phone,
      address: updatedUser!.address,
      isActive: updatedUser!.isActive,
      studentProfile,
      teacherProfile,
      createdAt: updatedUser!.createdAt.toISOString(),
      updatedAt: updatedUser!.updatedAt.toISOString(),
    };

    return successResponse(responseData, "Profil berhasil diperbarui");
  })
);

// OPTIONS handler for CORS
export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    },
  });
};
