import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withAuth } from "@/middleware/auth";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

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

const updateTenantSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").optional(),
  domain: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export const PUT = withErrorHandler(
  withRole(["ADMIN_IT"], async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON payload", 400);
    }

    const parseResult = updateTenantSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse("Invalid input", 400, parseResult.error.errors);
    }

    const updateData = parseResult.data;

    // Filter undefined
    const dataToUpdate = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(dataToUpdate).length === 0) {
      return successResponse({ message: "No data to update" });
    }

    const updatedTenant = await db
      .update(tenants)
      .set({ ...dataToUpdate, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning();

    if (updatedTenant.length === 0) {
      return errorResponse("Tenant tidak ditemukan", 404);
    }

    return successResponse(updatedTenant[0]);
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.APP_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
      "Access-Control-Allow-Credentials": "true",
    },
  });
};
