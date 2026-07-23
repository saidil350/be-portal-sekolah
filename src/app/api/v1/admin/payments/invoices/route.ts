import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { sppInvoices, users, payments } from "@/db/schema";
import { eq, desc, and, or, ilike, sql } from "drizzle-orm";

export const GET = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }
    
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "100", 10); // default 100 for backward compat if frontend not yet updated
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "ALL";

    const offset = (page - 1) * limit;
    
    // Base conditions
    const conditions: any[] = [eq(sppInvoices.tenantId, tenantId)];

    const monthStr = searchParams.get("month");
    const yearStr = searchParams.get("year");

    if (monthStr && monthStr !== "ALL") {
      conditions.push(eq(sppInvoices.month, parseInt(monthStr, 10)));
    }
    if (yearStr && yearStr !== "ALL") {
      conditions.push(eq(sppInvoices.year, parseInt(yearStr, 10)));
    }

    if (search) {
      conditions.push(
        or(
          ilike(sppInvoices.invoiceNumber, `%${search}%`),
          ilike(users.name, `%${search}%`)
        )
      );
    }

    if (status && status !== "ALL") {
      if (status === "FAILED") {
        conditions.push(
          or(
            eq(sppInvoices.status, "FAILED"),
            eq(sppInvoices.status, "EXPIRED"),
            eq(sppInvoices.status, "CANCELLED")
          )
        );
      } else {
        conditions.push(eq(sppInvoices.status, status as any));
      }
    }

    const whereClause = and(...conditions);

    // Ambil data invoice beserta nama siswanya, diurutkan dari yang terbaru
    const list = await db
      .select({
        id: sppInvoices.id,
        invoiceNumber: sppInvoices.invoiceNumber,
        amount: sppInvoices.amount,
        month: sppInvoices.month,
        year: sppInvoices.year,
        status: sppInvoices.status,
        dueDate: sppInvoices.dueDate,
        studentName: users.name,
        orderId: payments.orderId,
        paymentMethod: payments.paymentMethod,
      })
      .from(sppInvoices)
      .leftJoin(users, eq(sppInvoices.studentId, users.id))
      .leftJoin(payments, and(eq(payments.invoiceId, sppInvoices.id), eq(payments.status, "PAID")))
      .where(whereClause)
      .orderBy(desc(sppInvoices.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sppInvoices)
      .leftJoin(users, eq(sppInvoices.studentId, users.id))
      .where(whereClause);

    const total = Number(totalCountResult.count);

    return successResponse({
      items: list,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
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
