import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withRole } from "@/middleware/rbacMiddleware";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { emitToTenant } from "@/websocket";
import { gradeSubmissionSchema } from "@/validations/assignment";

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

export const POST = withErrorHandler(
  withRole(["SUPER_ADMIN", "ADMIN_IT", "GURU"], async (req: NextRequest, context, authSession) => {
    const { id: assignmentId, submissionId } = context.params;
    const tenantId = authSession.user.tenantId!;

    const [existing] = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.id, submissionId),
          eq(submissions.assignmentId, assignmentId),
          eq(submissions.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      return errorResponse("Submission not found", 404);
    }

    const body = await req.json();
    const parsed = gradeSubmissionSchema.parse(body);

    const [updated] = await db
      .update(submissions)
      .set({
        score: parsed.score,
        feedback: parsed.feedback || null,
        gradedBy: authSession.user.id,
        gradedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, submissionId))
      .returning();

    const mapped = mapSubmissionToResponse(updated);

    emitToTenant(tenantId, "assignment.graded", mapped);

    return successResponse(mapped, "Submission graded successfully");
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    },
  });
};
