import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { sppTariffs } from "@/db/schema";
import { eq, desc, and, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit-logger";

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  academicYear: z.string().optional(),
  isActive: z.enum(["true", "false", "all"]).default("all"),
});

const createSchema = z.object({
  name: z.string().min(3, "Nama tarif minimal 3 karakter"),
  amount: z.number().min(1000, "Nominal minimal Rp1.000"),
  academicYear: z.string().min(4, "Tahun ajaran wajib diisi"),
  grade: z.string().optional().nullable(),
  class: z.string().optional().nullable(),
  studentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const GET = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) return errorResponse("Tenant context missing", 400);

    const url = new URL(req.url);
    const query = Object.fromEntries(url.searchParams.entries());
    const parsedQuery = querySchema.safeParse(query);

    if (!parsedQuery.success) {
      return errorResponse("Invalid query parameters", 400, parsedQuery.error.errors);
    }

    const { page, limit, search, academicYear, isActive } = parsedQuery.data;
    const offset = (page - 1) * limit;

    const conditions = [eq(sppTariffs.tenantId, tenantId)];
    
    if (search) {
      conditions.push(ilike(sppTariffs.name, `%${search}%`));
    }
    if (academicYear) {
      conditions.push(eq(sppTariffs.academicYear, academicYear));
    }
    if (isActive !== "all") {
      conditions.push(eq(sppTariffs.isActive, isActive === "true"));
    }

    const whereClause = and(...conditions);

    const [data, totalCount] = await Promise.all([
      db.select()
        .from(sppTariffs)
        .where(whereClause)
        .orderBy(desc(sppTariffs.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(sppTariffs)
        .where(whereClause)
    ]);

    const total = Number(totalCount[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    return successResponse({
      data,
      meta: {
        page,
        limit,
        total,
        totalPages
      }
    });
  })
);

export const POST = withErrorHandler(
  withRole(["ADMIN_IT"], async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) return errorResponse("Tenant context missing", 400);

    const body = await req.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Invalid input", 400, parsed.error.errors);
    }

    const { name, amount, academicYear, grade, class: className, studentId, isActive } = parsed.data;

    const [newTariff] = await db.insert(sppTariffs).values({
      tenantId,
      name,
      amount,
      academicYear,
      grade: grade || null,
      class: className || null,
      studentId: studentId || null,
      isActive,
    }).returning();

    await logAudit("TARIFF_CREATED", newTariff.id, newTariff, undefined);

    return successResponse(newTariff, "Tarif berhasil dibuat", 201);
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.APP_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
      "Access-Control-Allow-Credentials": "true",
    },
  });
};
