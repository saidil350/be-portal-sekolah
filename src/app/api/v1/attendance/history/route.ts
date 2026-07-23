import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { attendanceRecords } from "@/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { parsePaginationParams, buildPaginatedResponse } from "@/utils/pagination";
import { ForbiddenError } from "@/utils/AppError";

const ROLES_WITH_READ_ALL = ["SUPER_ADMIN", "ADMIN_IT", "KEPALA_SEKOLAH", "STAFF"];

function mapAttendanceToResponse(record: any) {
  return {
    id: record.id,
    tenantId: record.tenantId,
    userId: record.userId,
    date: record.date,
    checkInTime: record.checkInTime?.toISOString() || null,
    checkOutTime: record.checkOutTime?.toISOString() || null,
    status: record.status,
    notes: record.notes,
    locationLatitude: record.locationLatitude,
    locationLongitude: record.locationLongitude,
    deviceInfo: record.deviceInfo,
    isRealtimeCheckedIn: record.isRealtimeCheckedIn,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export const GET = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    const { searchParams } = new URL(req.url);
    const { page, limit, offset } = parsePaginationParams(searchParams);

    const tenantId = authSession.user.tenantId;
    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }

    // Parse filter parameters
    const requestedUserId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");

    // Determine which user's data to fetch
    let targetUserId = authSession.user.id;

    if (requestedUserId && requestedUserId !== authSession.user.id) {
      // Requesting other user's data - check permission
      if (!ROLES_WITH_READ_ALL.includes(authSession.user.role)) {
        throw new ForbiddenError("Anda tidak memiliki izin untuk melihat absensi pengguna lain");
      }
      targetUserId = requestedUserId;
    }

    // Build conditions
    const conditions = [
      eq(attendanceRecords.tenantId, tenantId),
      eq(attendanceRecords.userId, targetUserId),
    ];

    if (startDate) {
      conditions.push(gte(attendanceRecords.date, startDate));
    }

    if (endDate) {
      conditions.push(lte(attendanceRecords.date, endDate));
    }

    if (status) {
      conditions.push(eq(attendanceRecords.status, status));
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(attendanceRecords)
      .where(whereClause);

    const totalItems = countResult[0]?.count ?? 0;

    // Get paginated records
    const records = await db
      .select()
      .from(attendanceRecords)
      .where(whereClause)
      .orderBy(sql`${attendanceRecords.date} DESC`)
      .limit(limit)
      .offset(offset);

    const paginated = buildPaginatedResponse(
      records.map(mapAttendanceToResponse),
      totalItems,
      page,
      limit
    );

    return successResponse(paginated.items, "Riwayat absensi berhasil diambil", 200, paginated.meta);
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
