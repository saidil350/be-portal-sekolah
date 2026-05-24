import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse } from "@/utils/apiResponse";
import { withAuth } from "@/middleware/auth";
import { withRole } from "@/middleware/rbacMiddleware";
import { parsePaginationParams, buildPaginatedResponse } from "@/utils/pagination";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and, ilike, or, sql, desc } from "drizzle-orm";
import { createUserSchema } from "@/validations/user";
import { NotFoundError, ForbiddenError, BadRequestError } from "@/utils/AppError";
import { auth } from "@/lib/auth";
import { AuthSession } from "@/middleware/auth";

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

// GET /api/v1/users — List users (paginated, filtered, tenant-scoped)
export const GET = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    const { searchParams } = new URL(req.url);
    const { page, limit, offset } = parsePaginationParams(searchParams);

    const search = searchParams.get("search") || undefined;
    const role = searchParams.get("role") || undefined;
    const isActiveParam = searchParams.get("isActive");
    const isActive =
      isActiveParam !== null ? isActiveParam === "true" : undefined;
    const tenantIdParam = searchParams.get("tenantId") || undefined;

    // Build conditions
    const conditions = [];

    // Tenant scoping: non-SUPER_ADMIN users can only see their own tenant
    if (authSession.user.role !== "SUPER_ADMIN") {
      conditions.push(eq(users.tenantId, authSession.user.tenantId!));
    } else if (tenantIdParam) {
      // SUPER_ADMIN can optionally filter by tenantId
      conditions.push(eq(users.tenantId, tenantIdParam));
    }

    // Role filter
    if (role) {
      conditions.push(eq(users.role, role));
    }

    // isActive filter
    if (isActive !== undefined) {
      conditions.push(eq(users.isActive, isActive));
    }

    // Search filter (name OR email)
    if (search) {
      conditions.push(
        or(
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(whereClause);

    const totalItems = countResult[0].count;

    // Get paginated users
    const userList = await db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const paginated = buildPaginatedResponse(
      userList.map(mapUserToResponse),
      totalItems,
      page,
      limit
    );

    return successResponse(paginated, "Users retrieved successfully");
  })
);

// POST /api/v1/users — Create a new user
export const POST = withErrorHandler(
  withRole(["SUPER_ADMIN", "ADMIN_IT"], async (req, context, authSession) => {
    const body = await req.json();
    const parsed = createUserSchema.parse(body);

    // If not SUPER_ADMIN, force tenantId to the authenticated user's tenantId
    const tenantId =
      authSession.user.role !== "SUPER_ADMIN"
        ? authSession.user.tenantId!
        : parsed.tenantId || authSession.user.tenantId!;

    if (!tenantId) {
      throw new BadRequestError("tenantId is required");
    }

    // Check for existing email
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, parsed.email),
    });

    if (existingUser) {
      throw new BadRequestError("Email already in use");
    }

    // Create user via Better Auth signUp which handles password hashing
    const result = await auth.api.signUpEmail({
      body: {
        email: parsed.email,
        name: parsed.name,
        password: parsed.password || "defaultPassword123",
      },
    });

    if (!result) {
      throw new BadRequestError("Failed to create user");
    }

    // Better Auth creates the user; now update role and tenantId in our table
    const betterAuthUser = (result as any).user;
    const userId = betterAuthUser?.id;

    if (!userId) {
      throw new BadRequestError("Failed to retrieve created user ID");
    }

    // Update the user record with role, tenantId, and isActive
    await db
      .update(users)
      .set({
        role: parsed.role,
        tenantId: tenantId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Fetch the updated user
    const createdUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!createdUser) {
      throw new NotFoundError("User not found after creation");
    }

    return successResponse(
      mapUserToResponse(createdUser),
      "User created successfully",
      201
    );
  })
);

// OPTIONS handler for CORS
export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    },
  });
};
