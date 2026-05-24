import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { successResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import {
  users,
  attendanceRecords,
  invoices,
  payments,
  assignments,
  submissions,
  notifications,
} from "@/db/schema";
import { eq, and, sql, count, desc } from "drizzle-orm";

export const GET = withErrorHandler(
  withAuth(async (req, _context, authSession) => {
    const { role, tenantId, id: userId } = authSession.user;

    const effectiveTenantId = tenantId;

    // If no tenant context, return empty results (SUPER_ADMIN may have no tenant)
    if (!effectiveTenantId) {
      return successResponse({
        recentActivity: [],
        pendingTasks: {
          ungradedSubmissions: 0,
          pendingInvoices: 0,
          unreadNotifications: 0,
        },
      });
    }

    // --- Build recent activity from attendance and payments ---
    const recentActivity: Array<{
      type: string;
      description: string;
      timestamp: string;
    }> = [];

    // Recent attendance check-ins (last 10 for admin/kepala, own records for others)
    const attendanceScope =
      role === "ADMIN_IT" || role === "KEPALA_SEKOLAH"
        ? eq(attendanceRecords.tenantId, effectiveTenantId)
        : and(
            eq(attendanceRecords.tenantId, effectiveTenantId),
            eq(attendanceRecords.userId, userId)
          );

    const recentAttendance = await db
      .select({
        userId: attendanceRecords.userId,
        userName: users.name,
        checkInTime: attendanceRecords.checkInTime,
        status: attendanceRecords.status,
        date: attendanceRecords.date,
      })
      .from(attendanceRecords)
      .innerJoin(users, eq(attendanceRecords.userId, users.id))
      .where(attendanceScope)
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(5);

    for (const record of recentAttendance) {
      recentActivity.push({
        type: "attendance",
        description: `${record.userName} checked in (${record.status})`,
        timestamp: record.checkInTime
          ? record.checkInTime.toISOString()
          : new Date(record.date).toISOString(),
      });
    }

    // Recent payments
    const paymentScope =
      role === "ADMIN_IT" || role === "KEPALA_SEKOLAH" || role === "STAFF"
        ? eq(payments.tenantId, effectiveTenantId)
        : and(
            eq(payments.tenantId, effectiveTenantId),
            eq(invoices.studentId, userId)
          );

    const recentPayments = await db
      .select({
        invoiceNumber: invoices.invoiceNumber,
        paidAt: payments.paidAt,
        amount: payments.amount,
      })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(paymentScope)
      .orderBy(desc(payments.paidAt))
      .limit(5);

    for (const payment of recentPayments) {
      recentActivity.push({
        type: "payment",
        description: `Invoice #${payment.invoiceNumber} paid (Rp ${payment.amount})`,
        timestamp: payment.paidAt.toISOString(),
      });
    }

    // Sort all activity by timestamp descending
    recentActivity.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Limit to 10 most recent
    const activity = recentActivity.slice(0, 10);

    // --- Pending tasks ---
    let ungradedSubmissions = 0;
    let pendingInvoices = 0;
    let unreadNotifications = 0;

    // Ungraded submissions
    if (role === "GURU") {
      const [ungradedResult] = await db
        .select({ count: count() })
        .from(submissions)
        .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
        .where(
          and(
            eq(assignments.teacherId, userId),
            eq(submissions.tenantId, effectiveTenantId),
            sql`${submissions.score} IS NULL`
          )
        );
      ungradedSubmissions = ungradedResult.count;
    } else if (
      role === "ADMIN_IT" ||
      role === "KEPALA_SEKOLAH"
    ) {
      const [ungradedResult] = await db
        .select({ count: count() })
        .from(submissions)
        .where(
          and(
            eq(submissions.tenantId, effectiveTenantId),
            sql`${submissions.score} IS NULL`
          )
        );
      ungradedSubmissions = ungradedResult.count;
    }

    // Pending invoices
    if (
      role === "ADMIN_IT" ||
      role === "KEPALA_SEKOLAH" ||
      role === "STAFF"
    ) {
      const [pendingInvoicesResult] = await db
        .select({ count: count() })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, effectiveTenantId),
            eq(invoices.status, "UNPAID")
          )
        );
      pendingInvoices = pendingInvoicesResult.count;
    } else if (role === "SISWA") {
      const [pendingInvoicesResult] = await db
        .select({ count: count() })
        .from(invoices)
        .where(
          and(
            eq(invoices.studentId, userId),
            eq(invoices.tenantId, effectiveTenantId),
            eq(invoices.status, "UNPAID")
          )
        );
      pendingInvoices = pendingInvoicesResult.count;
    }

    // Unread notifications
    const notificationScope =
      role === "ADMIN_IT" || role === "KEPALA_SEKOLAH"
        ? and(
            eq(notifications.tenantId, effectiveTenantId),
            eq(notifications.isRead, false)
          )
        : and(
            eq(notifications.tenantId, effectiveTenantId),
            eq(notifications.userId, userId),
            eq(notifications.isRead, false)
          );

    const [unreadResult] = await db
      .select({ count: count() })
      .from(notifications)
      .where(notificationScope);
    unreadNotifications = unreadResult.count;

    return successResponse({
      recentActivity: activity,
      pendingTasks: {
        ungradedSubmissions,
        pendingInvoices,
        unreadNotifications,
      },
    });
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
