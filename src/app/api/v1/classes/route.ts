import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { withAuth } from "@/middleware/auth";
import { withRole } from "@/middleware/rbacMiddleware";
import { successResponse } from "@/utils/apiResponse";
import { parsePaginationParams, buildPaginatedResponse } from "@/utils/pagination";
import { db } from "@/db";
import { classes, users, classEnrollments } from "@/db/schema";
import { eq, and, ilike, or, sql, desc } from "drizzle-orm";
import { createClassSchema } from "@/validations/class";

function mapClassToResponse(cls: any, studentCount: number = 0) {
  return {
    id: cls.id,
    tenantId: cls.tenantId,
    name: cls.name,
    code: cls.code,
    gradeLevel: cls.gradeLevel,
    homeroomTeacherId: cls.homeroomTeacherId,
    academicYear: cls.academicYear,
    studentCount,
    createdAt: cls.createdAt.toISOString(),
    updatedAt: cls.updatedAt.toISOString(),
  };
}

export const GET = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    const { searchParams } = new URL(req.url);
    const { page, limit, offset } = parsePaginationParams(searchParams);

    const search = searchParams.get("search") || "";
    const gradeLevel = searchParams.get("gradeLevel");
    const academicYear = searchParams.get("academicYear");

    // Tenant scoping: SUPER_ADMIN can use query param, others use their own tenantId
    const tenantId =
      authSession.user.role === "SUPER_ADMIN"
        ? searchParams.get("tenantId") || authSession.user.tenantId
        : authSession.user.tenantId;

    // Build conditions
    const conditions = [eq(classes.tenantId, tenantId!)];
    if (search) {
      conditions.push(ilike(classes.name, `%${search}%`));
    }
    if (gradeLevel) {
      conditions.push(eq(classes.gradeLevel, parseInt(gradeLevel, 10)));
    }
    if (academicYear) {
      conditions.push(eq(classes.academicYear, academicYear));
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(classes)
      .where(whereClause);

    const totalItems = countResult[0].count;

    // Get paginated classes
    const classList = await db
      .select()
      .from(classes)
      .where(whereClause)
      .orderBy(desc(classes.createdAt))
      .limit(limit)
      .offset(offset);

    // Get student counts for each class
    const classIds = classList.map((c) => c.id);

    let studentCounts: Record<string, number> = {};
    if (classIds.length > 0) {
      const counts = await db
        .select({
          classId: classEnrollments.classId,
          count: sql<number>`count(*)::int`,
        })
        .from(classEnrollments)
        .where(eq(classEnrollments.status, "active"))
        .groupBy(classEnrollments.classId);

      for (const row of counts) {
        studentCounts[row.classId] = row.count;
      }
    }

    const mapped = classList.map((cls) =>
      mapClassToResponse(cls, studentCounts[cls.id] || 0)
    );

    const paginated = buildPaginatedResponse(mapped, totalItems, page, limit);

    return successResponse(paginated, "Classes retrieved successfully");
  })
);

export const POST = withErrorHandler(
  withRole(["SUPER_ADMIN", "ADMIN_IT", "GURU"], async (req, context, authSession) => {
    const body = await req.json();
    const validated = createClassSchema.parse(body);

    // Force tenantId from authenticated session
    const tenantId = authSession.user.tenantId!;

    const [newClass] = await db
      .insert(classes)
      .values({
        ...validated,
        tenantId,
      })
      .returning();

    return successResponse(
      mapClassToResponse(newClass, 0),
      "Class created successfully",
      201
    );
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
