import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withAuth } from "@/middleware/auth";
import { db } from "@/db";
import { session } from "@/db/schema";
import { eq } from "drizzle-orm";

export const POST = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    // Extend session expiry by 7 days
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db
      .update(session)
      .set({
        expiresAt: newExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(session.id, authSession.session.id));

    return successResponse(
      {
        token: authSession.session.token,
        expiresAt: newExpiresAt.toISOString(),
        user: {
          id: authSession.user.id,
          email: authSession.user.email,
          name: authSession.user.name,
          role: authSession.user.role,
          tenantId: authSession.user.tenantId,
          avatarUrl: authSession.user.avatarUrl,
          isActive: authSession.user.isActive,
          createdAt: authSession.user.createdAt.toISOString(),
          updatedAt: authSession.user.updatedAt.toISOString(),
        },
      },
      "Token berhasil diperbarui"
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
