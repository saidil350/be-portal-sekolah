import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { attendanceRecords } from "@/db/schema";
import { classEnrollments } from "@/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { withRole } from "@/middleware/rbacMiddleware";

export const GET = withErrorHandler(
  withRole(
    ["SUPER_ADMIN", "ADMIN_IT", "KEPALA_SEKOLAH", "GURU", "STAFF"],
    async (req, context, authSession) => {
      const { searchParams } = new URL(req.url);

      const tenantId = authSession.user.tenantId;
      if (!tenantId) {
        return errorResponse("Tenant context missing", 400);
      }

      // Parse filter parameters
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      const classId = searchParams.get("classId");

      // Build base conditions - always tenant-scoped
      const conditions = [eq(attendanceRecords.tenantId, tenantId)];

      if (startDate) {
        conditions.push(gte(attendanceRecords.date, startDate));
      }

      if (endDate) {
        conditions.push(lte(attendanceRecords.date, endDate));
      }

      // If classId is provided, filter by students enrolled in that class
      let queryBase;
      if (classId) {
        // Join with class_enrollments to filter by class
        queryBase = db
          .select({
            status: attendanceRecords.status,
            count: sql<number>`count(*)::int`,
          })
          .from(attendanceRecords)
          .innerJoin(
            classEnrollments,
            and(
              eq(classEnrollments.studentId, attendanceRecords.userId),
              eq(classEnrollments.classId, classId),
              eq(classEnrollments.status, "active")
            )
          )
          .where(and(...conditions))
          .groupBy(attendanceRecords.status);
      } else {
        queryBase = db
          .select({
            status: attendanceRecords.status,
            count: sql<number>`count(*)::int`,
          })
          .from(attendanceRecords)
          .where(and(...conditions))
          .groupBy(attendanceRecords.status);
      }

      const statusCounts = await queryBase;

      // Build summary object
      const summary: Record<string, number> = {
        PRESENT: 0,
        LATE: 0,
        ABSENT: 0,
        SICK: 0,
        EXCUSED: 0,
      };

      let totalRecords = 0;
      for (const row of statusCounts) {
        summary[row.status] = row.count;
        totalRecords += row.count;
      }

      // Calculate attendance rate (PRESENT + EXCUSED) / total
      const attendanceRate =
        totalRecords > 0
          ? Number(
              (
                ((summary.PRESENT + summary.EXCUSED) / totalRecords) *
                100
              ).toFixed(2)
            ) / 100
          : 0;

      return successResponse(
        {
          totalRecords,
          summary,
          attendanceRate,
        },
        "Laporan absensi berhasil diambil"
      );
    }
  )
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
