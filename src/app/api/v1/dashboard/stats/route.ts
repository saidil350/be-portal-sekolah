import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { successResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import {
  users,
  tenants,
  attendanceRecords,
} from "@/db/schema";
import { eq, and, sql, count } from "drizzle-orm";

export const GET = withErrorHandler(
  withAuth(async (req, _context, authSession) => {
    const { role, tenantId, id: userId } = authSession.user;

    // SUPER_ADMIN: platform-wide stats
    if (role === "SUPER_ADMIN") {
      const [totalSchoolsResult] = await db
        .select({ count: count() })
        .from(tenants)
        .where(eq(tenants.isActive, true));

      const [totalUsersResult] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.isActive, true));

      const serviceStatus = "99.98%";

      return successResponse({
        totalSchools: totalSchoolsResult.count,
        monthlyRevenue: "0",
        serviceStatus,
        totalUsers: totalUsersResult.count,
      });
    }

    // ADMIN_IT / KEPALA_SEKOLAH: tenant-scoped stats
    if (role === "ADMIN_IT" || role === "KEPALA_SEKOLAH") {
      if (!tenantId) {
        return successResponse({
          totalStudents: 0,
          totalTeachers: 0,
          totalClasses: 0,
          attendanceRate: "0",
        });
      }

      const [totalStudentsResult] = await db
        .select({ count: count() })
        .from(users)
        .where(
          and(eq(users.tenantId, tenantId), eq(users.role, "SISWA"), eq(users.isActive, true))
        );

      const [totalTeachersResult] = await db
        .select({ count: count() })
        .from(users)
        .where(
          and(eq(users.tenantId, tenantId), eq(users.role, "GURU"), eq(users.isActive, true))
        );

      // Attendance rate: percentage of PRESENT / HADIR records out of total records in tenant
      const [attendanceResult] = await db
        .select({
          total: count(),
          present: sql<number>`COUNT(CASE WHEN ${attendanceRecords.status} IN ('HADIR', 'PRESENT') THEN 1 END)`,
        })
        .from(attendanceRecords)
        .where(eq(attendanceRecords.tenantId, tenantId));

      const attendanceRate =
        attendanceResult.total > 0
          ? ((attendanceResult.present / attendanceResult.total) * 100).toFixed(1)
          : "0";

      return successResponse({
        totalStudents: totalStudentsResult.count,
        totalTeachers: totalTeachersResult.count,
        totalClasses: 0,
        attendanceRate,
      });
    }

    // GURU: teacher-specific stats
    if (role === "GURU") {
      if (!tenantId) {
        return successResponse({
          attendanceRate: "0",
          ungradedAssignments: 0,
          totalSubjects: 0,
        });
      }

      // Attendance rate for this teacher
      const [attendanceResult] = await db
        .select({
          total: count(),
          present: sql<number>`COUNT(CASE WHEN ${attendanceRecords.status} IN ('HADIR', 'PRESENT') THEN 1 END)`,
        })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.tenantId, tenantId),
            eq(attendanceRecords.userId, userId)
          )
        );

      const attendanceRate =
        attendanceResult.total > 0
          ? ((attendanceResult.present / attendanceResult.total) * 100).toFixed(1)
          : "0";

      return successResponse({
        attendanceRate,
        ungradedAssignments: 0,
        totalSubjects: 0,
      });
    }

    // STAFF: staff-specific stats
    if (role === "STAFF") {
      if (!tenantId) {
        return successResponse({
          createdInvoices: 0,
          pendingPayments: 0,
          collectedSPP: "0",
        });
      }

      return successResponse({
        createdInvoices: 0,
        pendingPayments: 0,
        collectedSPP: "0",
      });
    }

    // SISWA: student-specific stats
    if (role === "SISWA") {
      if (!tenantId) {
        return successResponse({
          attendanceRate: "0",
          pendingAssignments: 0,
          sppBill: "0",
        });
      }

      // Attendance rate for this student
      const [attendanceResult] = await db
        .select({
          total: count(),
          present: sql<number>`COUNT(CASE WHEN ${attendanceRecords.status} IN ('HADIR', 'PRESENT') THEN 1 END)`,
        })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.tenantId, tenantId),
            eq(attendanceRecords.userId, userId)
          )
        );

      const attendanceRate =
        attendanceResult.total > 0
          ? ((attendanceResult.present / attendanceResult.total) * 100).toFixed(1)
          : "0";

      return successResponse({
        attendanceRate,
        pendingAssignments: 0,
        sppBill: "0",
      });
    }

    // Fallback for unrecognized roles
    return successResponse({});
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
