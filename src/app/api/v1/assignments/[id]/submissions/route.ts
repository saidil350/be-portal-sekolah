import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { withRole } from "@/middleware/rbacMiddleware";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { parsePaginationParams, buildPaginatedResponse } from "@/utils/pagination";
import { db } from "@/db";
import { assignments, submissions } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { emitToTenant } from "@/websocket";
import { submitAssignmentSchema } from "@/validations/assignment";

function mapSubmissionToResponse(s: any) {
  return {
    id: s.id,
    tenantId: s.tenantId,
    assignmentId: s.assignmentId,
    studentId: s.studentId,
    submittedAt: s.submittedAt.toISOString(),
    attachments: s.attachments,
    notes: s.notes,
    score: s.score,
    gradedBy: s.gradedBy,
    gradedAt: s.gradedAt?.toISOString() || null,
    feedback: s.feedback,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export const GET = withErrorHandler(
  withAuth(async (req: NextRequest, context: { params: Record<string, string> }, authSession) => {
    const { id: assignmentId } = context.params;
    const tenantId = authSession.user.tenantId!;
    const userRole = authSession.user.role;

    const { page, limit, offset } = parsePaginationParams(req.nextUrl.searchParams);

    // Verify assignment exists and belongs to tenant
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.id, assignmentId), eq(assignments.tenantId, tenantId)))
      .limit(1);

    if (!assignment) {
      return errorResponse("Assignment not found", 404);
    }

    // Build conditions
    const conditions = [eq(submissions.assignmentId, assignmentId), eq(submissions.tenantId, tenantId)];

    // Students can only see their own submissions
    const isAdminOrTeacher = ["SUPER_ADMIN", "ADMIN_IT", "GURU"].includes(userRole);
    if (!isAdminOrTeacher) {
      conditions.push(eq(submissions.studentId, authSession.user.id));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(submissions)
        .where(whereClause)
        .orderBy(desc(submissions.submittedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: submissions.id })
        .from(submissions)
        .where(whereClause),
    ]);

    const totalItems = countResult.length;
    const mapped = items.map(mapSubmissionToResponse);
    const paginated = buildPaginatedResponse(mapped, totalItems, page, limit);

    return successResponse(paginated, "Submissions retrieved successfully");
  })
);

export const POST = withErrorHandler(
  withRole(["SISWA"], async (req: NextRequest, context: { params: Record<string, string> }, authSession) => {
    const { id: assignmentId } = context.params;
    const tenantId = authSession.user.tenantId!;

    // Verify assignment exists and belongs to tenant
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.id, assignmentId), eq(assignments.tenantId, tenantId)))
      .limit(1);

    if (!assignment) {
      return errorResponse("Assignment not found", 404);
    }

    const body = await req.json();
    const parsed = submitAssignmentSchema.parse(body);

    const [newSubmission] = await db
      .insert(submissions)
      .values({
        tenantId,
        assignmentId,
        studentId: authSession.user.id,
        attachments: parsed.attachments,
        notes: parsed.notes || null,
      })
      .returning();

    const mapped = mapSubmissionToResponse(newSubmission);

    emitToTenant(tenantId, "assignment.submitted", mapped);

    return successResponse(mapped, "Submission created successfully", 201);
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    },
  });
};
