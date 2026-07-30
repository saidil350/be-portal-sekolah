import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { academicYears } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const GET = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }

    const list = await db
      .select()
      .from(academicYears)
      .where(eq(academicYears.tenantId, tenantId))
      .orderBy(desc(academicYears.createdAt))
      .execute();

    return successResponse(list);
  })
);

export const POST = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }

    const body = await req.json();
    const { name, semester, isCurrent, startDate, endDate } = body;

    if (!name || !name.trim()) {
      return errorResponse("Nama tahun ajaran wajib diisi (misal: 2025/2026)", 400);
    }

    const sem = semester ? parseInt(semester, 10) : 1;
    const currentFlag = Boolean(isCurrent);

    if (currentFlag) {
      // Nonaktifkan isCurrent pada tahun ajaran lain
      await db
        .update(academicYears)
        .set({ isCurrent: false })
        .where(eq(academicYears.tenantId, tenantId))
        .execute();
    }

    const created = await db
      .insert(academicYears)
      .values({
        tenantId,
        name: name.trim(),
        semester: sem,
        isCurrent: currentFlag,
        startDate: startDate ? startDate : null,
        endDate: endDate ? endDate : null,
      })
      .returning()
      .execute();

    return successResponse(created[0], "Tahun ajaran berhasil dibuat", 201);
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
