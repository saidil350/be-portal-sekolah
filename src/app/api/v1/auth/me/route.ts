import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse } from "@/utils/apiResponse";
import { withAuth } from "@/middleware/auth";

export const GET = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    return successResponse({
      id: authSession.user.id,
      email: authSession.user.email,
      name: authSession.user.name,
      role: authSession.user.role,
      tenantId: authSession.user.tenantId,
      avatarUrl: authSession.user.avatarUrl,
      isActive: authSession.user.isActive,
      createdAt: authSession.user.createdAt.toISOString(),
      updatedAt: authSession.user.updatedAt.toISOString(),
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
