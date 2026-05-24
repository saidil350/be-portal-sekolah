import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { successResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import {
  users,
  tenants,
  classes,
  attendanceRecords,
  invoices,
  payments,
  assignments,
  submissions,
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

      const [revenueResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
        })
        .from(payments);

      // Calculate uptime as a static value for demonstration
      const serviceStatus = "99.98%";

      return successResponse({
        totalSchools: totalSchoolsResult.count,
        monthlyRevenue: revenueResult.total,
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

      const [totalClassesResult] = await db
        .select({ count: count() })
        .from(classes)
        .where(eq(classes.tenantId, tenantId));

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
        totalClasses: totalClassesResult.count,
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

      // Ungraded submissions for assignments created by this teacher
      const [ungradedResult] = await db
        .select({ count: count() })
        .from(submissions)
        .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
        .where(
          and(
            eq(assignments.teacherId, userId),
            eq(submissions.tenantId, tenantId),
            sql`${submissions.score} IS NULL`
          )
        );

      // Total distinct assignments (subjects) taught by this teacher
      const [subjectsResult] = await db
        .select({ count: count() })
        .from(assignments)
        .where(
          and(eq(assignments.teacherId, userId), eq(assignments.tenantId, tenantId))
        );

      return successResponse({
        attendanceRate,
        ungradedAssignments: ungradedResult.count,
        totalSubjects: subjectsResult.count,
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

      // Total invoices created in this tenant
      const [invoicesResult] = await db
        .select({ count: count() })
        .from(invoices)
        .where(eq(invoices.tenantId, tenantId));

      // Pending (unpaid) invoices
      const [pendingResult] = await db
        .select({ count: count() })
        .from(invoices)
        .where(
          and(eq(invoices.tenantId, tenantId), eq(invoices.status, "UNPAID"))
        );

      // Total collected SPP (sum of paid invoice amounts)
      const [collectedResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
        })
        .from(payments)
        .where(eq(payments.tenantId, tenantId));

      return successResponse({
        createdInvoices: invoicesResult.count,
        pendingPayments: pendingResult.count,
        collectedSPP: collectedResult.total,
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

      // Pending assignments: assignments in the student's classes where they haven't submitted
      const [pendingResult] = await db
        .select({ count: count() })
        .from(assignments)
        .leftJoin(
          submissions,
          and(
            eq(submissions.assignmentId, assignments.id),
            eq(submissions.studentId, userId)
          )
        )
        .where(
          and(
            eq(assignments.tenantId, tenantId),
            sql`${submissions.id} IS NULL`
          )
        );

      // Current unpaid SPP bill for this student
      const [sppResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${invoices.amount}), 0)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.studentId, userId),
            eq(invoices.tenantId, tenantId),
            eq(invoices.status, "UNPAID")
          )
        );

      return successResponse({
        attendanceRate,
        pendingAssignments: pendingResult.count,
        sppBill: sppResult.total,
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
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    },
  });
};
