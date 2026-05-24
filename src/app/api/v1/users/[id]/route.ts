import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse } from "@/utils/apiResponse";
import { withAuth } from "@/middleware/auth";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { updateUserSchema } from "@/validations/user";
import { NotFoundError, ForbiddenError } from "@/utils/AppError";

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

// GET /api/v1/users/[id] — Get user by ID
export const GET = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    const { id } = await context.params;

    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Tenant scoping: non-SUPER_ADMIN can only view users in same tenant
    if (
      authSession.user.role !== "SUPER_ADMIN" &&
      user.tenantId !== authSession.user.tenantId
    ) {
      throw new ForbiddenError("You do not have access to this user");
    }

    return successResponse(mapUserToResponse(user), "User retrieved successfully");
  })
);

// PATCH /api/v1/users/[id] — Update user by ID
export const PATCH = withErrorHandler(
  withRole(["SUPER_ADMIN", "ADMIN_IT"], async (req, context, authSession) => {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = updateUserSchema.parse(body);

    // Fetch existing user
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      throw new NotFoundError("User not found");
    }

    // Tenant scoping: non-SUPER_ADMIN can only update users in same tenant
    if (
      authSession.user.role !== "SUPER_ADMIN" &&
      existingUser.tenantId !== authSession.user.tenantId
    ) {
      throw new ForbiddenError("You do not have access to update this user");
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (parsed.name !== undefined) {
      updateData.name = parsed.name;
    }
    if (parsed.email !== undefined) {
      updateData.email = parsed.email;
    }
    if (parsed.role !== undefined) {
      updateData.role = parsed.role;
    }
    if (parsed.isActive !== undefined) {
      updateData.isActive = parsed.isActive;
    }
    if (parsed.image !== undefined) {
      updateData.image = parsed.image;
    }

    // Update the user
    await db.update(users).set(updateData).where(eq(users.id, id));

    // Fetch the updated user
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!updatedUser) {
      throw new NotFoundError("User not found after update");
    }

    return successResponse(
      mapUserToResponse(updatedUser),
      "User updated successfully"
    );
  })
);

// DELETE /api/v1/users/[id] — Soft delete user (set isActive = false)
export const DELETE = withErrorHandler(
  withRole(["SUPER_ADMIN", "ADMIN_IT"], async (req, context, authSession) => {
    const { id } = await context.params;

    // Fetch existing user
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      throw new NotFoundError("User not found");
    }

    // Tenant scoping: non-SUPER_ADMIN can only delete users in same tenant
    if (
      authSession.user.role !== "SUPER_ADMIN" &&
      existingUser.tenantId !== authSession.user.tenantId
    ) {
      throw new ForbiddenError("You do not have access to delete this user");
    }

    // Soft delete: set isActive to false
    await db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return successResponse(null, "User deactivated successfully");
  })
);

// OPTIONS handler for CORS
export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    },
  });
};
