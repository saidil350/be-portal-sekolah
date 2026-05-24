import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

export const GET = withErrorHandler(async (req: NextRequest, context) => {
  const { domain } = context.params;

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, domain),
  });

  if (!tenant) {
    return errorResponse("Sekolah tidak ditemukan", 404);
  }

  return successResponse({
    id: tenant.id,
    name: tenant.name,
    domain: tenant.domain,
    slug: tenant.slug,
    logoUrl: tenant.logoUrl,
    address: tenant.address,
    phone: tenant.phone,
    isActive: tenant.isActive,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
  });
});

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
