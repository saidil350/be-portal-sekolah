import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { attendanceRecords } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { checkOutSchema } from "@/validations/attendance";
import { emitToTenant } from "@/websocket";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/utils/AppError";

const allowedAttendanceRoles = new Set(["STAFF", "GURU", "ADMIN_IT", "KEPALA_SEKOLAH"]);

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
    selfieUrl: record.selfieUrl,
    faceVerified: record.faceVerified,
    deviceInfo: record.deviceInfo,
    isRealtimeCheckedIn: record.isRealtimeCheckedIn,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export const POST = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    const body = await req.json();
    const parsed = checkOutSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Validasi gagal", 400, parsed.error.errors);
    }

    const { latitude, longitude, selfieUrl, faceVerified, notes } = parsed.data;
    const userId = authSession.user.id;
    const tenantId = authSession.user.tenantId;

    if (!allowedAttendanceRoles.has(authSession.user.role)) {
      throw new ForbiddenError("Role ini tidak memiliki akses check-out attendance");
    }

    if (!latitude || !longitude) {
      throw new BadRequestError("GPS wajib divalidasi sebelum check-out");
    }

    if (!selfieUrl || !faceVerified) {
      throw new BadRequestError("Verifikasi wajah wajib dilakukan sebelum check-out");
    }

    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }

    // Get today's date
    const today = new Date().toISOString().split("T")[0];

    // Find today's attendance record for the user
    const existingRecords = await db
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

    if (existingRecords.length === 0) {
      throw new NotFoundError("Anda belum check-in hari ini");
    }

    const existingRecord = existingRecords[0];

    if (existingRecord.checkOutTime) {
      throw new BadRequestError("Anda sudah check-out hari ini");
    }

    const now = new Date();

    // Update the attendance record with check-out time
    const [updatedRecord] = await db
      .update(attendanceRecords)
      .set({
        checkOutTime: now,
        locationLatitude: latitude ?? existingRecord.locationLatitude,
        locationLongitude: longitude ?? existingRecord.locationLongitude,
        selfieUrl,
        faceVerified: true,
        notes: notes ?? existingRecord.notes,
        updatedAt: now,
      })
      .where(eq(attendanceRecords.id, existingRecord.id))
      .returning();

    // Emit WebSocket event
    emitToTenant(tenantId, "attendance.checked_out", mapAttendanceToResponse(updatedRecord));

    return successResponse(
      mapAttendanceToResponse(updatedRecord),
      "Check-out berhasil"
    );
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.APP_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
      "Access-Control-Allow-Credentials": "true",
    },
  });
};
