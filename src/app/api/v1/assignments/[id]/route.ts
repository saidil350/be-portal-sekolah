import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { withRole } from "@/middleware/rbacMiddleware";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { assignments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { updateAssignmentSchema } from "@/validations/assignment";

function mapAssignmentToResponse(a: any) {
  return {
    id: a.id,
    tenantId: a.tenantId,
    title: a.title,
    description: a.description,
    classId: a.classId,
    teacherId: a.teacherId,
    dueDate: a.dueDate.toISOString(),
    maxScore: a.maxScore,
    attachments: a.attachments,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export const GET = withErrorHandler(
  withAuth(async (req: NextRequest, context: { params: Record<string, string> }, authSession) => {
    const { id } = context.params;
    const tenantId = authSession.user.tenantId!;

    const [assignment] = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.id, id), eq(assignments.tenantId, tenantId)))
      .limit(1);

    if (!assignment) {
      return errorResponse("Assignment not found", 404);
    }

    return successResponse(mapAssignmentToResponse(assignment), "Assignment retrieved successfully");
  })
);

export const PATCH = withErrorHandler(
  withRole(["SUPER_ADMIN", "ADMIN_IT", "GURU"], async (req: NextRequest, context: { params: Record<string, string> }, authSession) => {
    const { id } = context.params;
    const tenantId = authSession.user.tenantId!;

    const body = await req.json();
    const parsed = updateAssignmentSchema.parse(body);

    const [existing] = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.id, id), eq(assignments.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      return errorResponse("Assignment not found", 404);
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (parsed.title !== undefined) updateData.title = parsed.title;
    if (parsed.description !== undefined) updateData.description = parsed.description;
    if (parsed.dueDate !== undefined) updateData.dueDate = new Date(parsed.dueDate);
    if (parsed.maxScore !== undefined) updateData.maxScore = parsed.maxScore;
    if (parsed.attachments !== undefined) updateData.attachments = parsed.attachments;

    const [updated] = await db
      .update(assignments)
      .set(updateData)
      .where(eq(assignments.id, id))
      .returning();

    return successResponse(mapAssignmentToResponse(updated), "Assignment updated successfully");
  })
);

export const DELETE = withErrorHandler(
  withRole(["SUPER_ADMIN", "ADMIN_IT"], async (req: NextRequest, context: { params: Record<string, string> }, authSession) => {
    const { id } = context.params;
    const tenantId = authSession.user.tenantId!;

    const [existing] = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.id, id), eq(assignments.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      return errorResponse("Assignment not found", 404);
    }

    await db.delete(assignments).where(eq(assignments.id, id));

    return successResponse(null, "Assignment deleted successfully");
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    },
  });
};
