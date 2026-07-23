import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loginSchema } from "@/validations/auth";
import { z } from "zod";

function mapUserToResponse(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    avatarUrl: user.image,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse("Validasi gagal", 400, parsed.error.errors);
  }

  const { email, password, tenantDomain } = parsed.data;

  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
    });

    if (!result) {
      return errorResponse("Email atau kata sandi salah", 401);
    }

    // result from Better Auth: { token, user }
    const token = (result as any).token;
    const betterAuthUser = (result as any).user;

    if (!betterAuthUser || !token) {
      return errorResponse("Login gagal", 401);
    }

    // Get full user data from our users table
    const fullUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!fullUser) {
      return errorResponse("User tidak ditemukan", 404);
    }

    if (!fullUser.isActive) {
      return errorResponse("Akun telah dinonaktifkan", 403);
    }

    // If tenantDomain provided, validate tenant
    if (tenantDomain) {
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.slug, tenantDomain),
      });

      if (!tenant) {
        return errorResponse("Sekolah tidak ditemukan", 404);
      }

      if (fullUser.tenantId !== tenant.id) {
        return errorResponse("Anda tidak terdaftar di sekolah ini", 403);
      }
    }

    // Get session expiry from Better Auth's session
    const sessionData = await db.query.session.findFirst({
      where: (s: any) => eq(s.token, token),
    });

    const expiresAt = sessionData
      ? sessionData.expiresAt.toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    return successResponse(
      {
        token,
        expiresAt,
        user: mapUserToResponse(fullUser),
      },
      "Login berhasil"
    );
  } catch (error: any) {
    return errorResponse(
      error.message || "Email atau kata sandi salah",
      401
    );
  }
});

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
