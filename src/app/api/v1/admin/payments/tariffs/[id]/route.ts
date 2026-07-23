import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { sppTariffs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit-logger";

const updateSchema = z.object({
  name: z.string().min(3, "Nama tarif minimal 3 karakter").optional(),
  amount: z.number().min(1000, "Nominal minimal Rp1.000").optional(),
  academicYear: z.string().min(4, "Tahun ajaran wajib diisi").optional(),
  grade: z.string().optional().nullable(),
  class: z.string().optional().nullable(),
  studentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const PUT = withErrorHandler(
  withRole(["ADMIN_IT"], async (req, { params }, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) return errorResponse("Tenant context missing", 400);

    const { id } = await params;
    if (!id) return errorResponse("ID tarif tidak valid", 400);

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Invalid input", 400, parsed.error.errors);
    }

    const updateData = parsed.data;
    if (updateData.grade === undefined) delete updateData.grade;
    if (updateData.class === undefined) delete updateData.class;
    if (updateData.studentId === undefined) delete updateData.studentId;

    const [updatedTariff] = await db.update(sppTariffs)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(sppTariffs.id, id as string), eq(sppTariffs.tenantId, tenantId)))
      .returning();

    if (!updatedTariff) {
      return errorResponse("Tarif tidak ditemukan", 404);
    }

    await logAudit("TARIFF_UPDATED", updatedTariff.id, updateData, undefined);

    return successResponse(updatedTariff, "Tarif berhasil diperbarui", 200);
  })
);

export const DELETE = withErrorHandler(
  withRole(["ADMIN_IT"], async (req, { params }, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) return errorResponse("Tenant context missing", 400);

    const { id } = await params;
    if (!id) return errorResponse("ID tarif tidak valid", 400);

    const [deletedTariff] = await db.delete(sppTariffs)
      .where(and(eq(sppTariffs.id, id as string), eq(sppTariffs.tenantId, tenantId)))
      .returning();

    if (!deletedTariff) {
      return errorResponse("Tarif tidak ditemukan", 404);
    }

    await logAudit("TARIFF_DELETED", deletedTariff.id, { name: deletedTariff.name }, undefined);

    return successResponse(null, "Tarif berhasil dihapus", 200);
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.APP_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
      "Access-Control-Allow-Credentials": "true",
    },
  });
};
