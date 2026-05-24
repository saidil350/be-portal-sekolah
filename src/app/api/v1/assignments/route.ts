import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { withRole } from "@/middleware/rbacMiddleware";
import { successResponse } from "@/utils/apiResponse";
import { parsePaginationParams, buildPaginatedResponse } from "@/utils/pagination";
import { db } from "@/db";
import { assignments } from "@/db/schema";
import { eq, and, ilike, desc } from "drizzle-orm";
import { emitToTenant } from "@/websocket";
import { createAssignmentSchema } from "@/validations/assignment";

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
  withAuth(async (req: NextRequest, _context, authSession) => {
    const { page, limit, offset } = parsePaginationParams(req.nextUrl.searchParams);
    const tenantId = authSession.user.tenantId!;
    const classId = req.nextUrl.searchParams.get("classId");
    const teacherId = req.nextUrl.searchParams.get("teacherId");
    const search = req.nextUrl.searchParams.get("search");

    const conditions = [eq(assignments.tenantId, tenantId)];

    if (classId) {
      conditions.push(eq(assignments.classId, classId));
    }
    if (teacherId) {
      conditions.push(eq(assignments.teacherId, teacherId));
    }
    if (search) {
      conditions.push(ilike(assignments.title, `%${search}%`));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(assignments)
        .where(whereClause)
        .orderBy(desc(assignments.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: assignments.id })
        .from(assignments)
        .where(whereClause),
    ]);

    const totalItems = countResult.length;
    const mapped = items.map(mapAssignmentToResponse);
    const paginated = buildPaginatedResponse(mapped, totalItems, page, limit);

    return successResponse(paginated, "Assignments retrieved successfully");
  })
);

export const POST = withErrorHandler(
  withRole(["SUPER_ADMIN", "ADMIN_IT", "GURU"], async (req: NextRequest, _context, authSession) => {
    const body = await req.json();
    const parsed = createAssignmentSchema.parse(body);

    const tenantId = authSession.user.tenantId!;

    const [newAssignment] = await db
      .insert(assignments)
      .values({
        ...parsed,
        tenantId,
        dueDate: new Date(parsed.dueDate),
      })
      .returning();

    const mapped = mapAssignmentToResponse(newAssignment);

    emitToTenant(tenantId, "assignment.created", mapped);

    return successResponse(mapped, "Assignment created successfully", 201);
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
