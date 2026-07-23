import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { sppInvoices, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const GET = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }
    
    console.log("Fetching invoices for tenant:", tenantId);

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
      })
      .from(sppInvoices)
      .leftJoin(users, eq(sppInvoices.studentId, users.id))
      .where(eq(sppInvoices.tenantId, tenantId))
      .orderBy(desc(sppInvoices.createdAt))
      .limit(100);

    console.log("Invoices returned from DB:", list);
    return successResponse(list);
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
