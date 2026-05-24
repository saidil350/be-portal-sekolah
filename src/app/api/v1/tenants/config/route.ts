import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withAuth } from "@/middleware/auth";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

export const GET = withErrorHandler(
  withAuth(async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      return errorResponse("Tenant tidak ditemukan", 404);
    }

    return successResponse({
      themeMode: "system",
      primaryColor: "#4f46e5",
      academicYearStart: `${new Date().getFullYear()}-07`,
      academicYearEnd: `${new Date().getFullYear() + 1}-06`,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl,
        address: tenant.address,
        phone: tenant.phone,
        isActive: tenant.isActive,
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
