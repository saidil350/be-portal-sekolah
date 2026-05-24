import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { attendanceRecords } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { checkInSchema } from "@/validations/attendance";
import { emitToTenant } from "@/websocket";
import { BadRequestError } from "@/utils/AppError";

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

export const POST = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    const body = await req.json();
    const parsed = checkInSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Validasi gagal", 400, parsed.error.errors);
    }

    const { latitude, longitude, notes } = parsed.data;
    const userId = authSession.user.id;
    const tenantId = authSession.user.tenantId;

    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }

    // Get today's date
    const today = new Date().toISOString().split("T")[0];

    // Check if user already has attendance record for today
    const existingRecord = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.userId, userId),
          eq(attendanceRecords.tenantId, tenantId),
          sql`DATE(${attendanceRecords.date}) = ${today}`
        )
      )
      .limit(1);

    if (existingRecord.length > 0) {
      throw new BadRequestError("Anda sudah check-in hari ini");
    }

    // Determine status based on check-in time
    const now = new Date();
    const checkInHour = now.getHours();
    const checkInMinute = now.getMinutes();
    // Consider late if after 08:00
    const isLate = checkInHour > 8 || (checkInHour === 8 && checkInMinute > 0);
    const status = isLate ? "LATE" : "PRESENT";

    // Create new attendance record
    const [record] = await db
      .insert(attendanceRecords)
      .values({
        tenantId,
        userId,
        date: today,
        checkInTime: now,
        status,
        locationLatitude: latitude ?? null,
        locationLongitude: longitude ?? null,
        notes: notes ?? null,
        isRealtimeCheckedIn: true,
      })
      .returning();

    // Emit WebSocket event
    emitToTenant(tenantId, "attendance.checked_in", mapAttendanceToResponse(record));

    return successResponse(
      mapAttendanceToResponse(record),
      "Check-in berhasil",
      201
    );
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    },
  });
};
