import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { sppTariffs } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit-logger";

const bulkActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Minimal pilih satu tarif"),
  action: z.enum(["ACTIVATE", "DEACTIVATE", "DELETE"]),
});

export const POST = withErrorHandler(
  withRole(["ADMIN_IT"], async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) return errorResponse("Tenant context missing", 400);

    const body = await req.json();
    const parsed = bulkActionSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Invalid input", 400, parsed.error.errors);
    }

    const { ids, action } = parsed.data;

    let updatedCount = 0;
    
    if (action === "DELETE") {
      const result = await db.delete(sppTariffs)
        .where(and(inArray(sppTariffs.id, ids), eq(sppTariffs.tenantId, tenantId)))
        .returning({ id: sppTariffs.id });
      updatedCount = result.length;
      await logAudit("TARIFF_BULK_DELETED", "bulk", { count: updatedCount, ids }, undefined);
    } else {
      const isActive = action === "ACTIVATE";
      const result = await db.update(sppTariffs)
        .set({ isActive, updatedAt: new Date() })
        .where(and(inArray(sppTariffs.id, ids), eq(sppTariffs.tenantId, tenantId)))
        .returning({ id: sppTariffs.id });
      updatedCount = result.length;
      await logAudit("TARIFF_BULK_UPDATED", tenantId, { updatedCount }, undefined);
    }

    return successResponse({ count: updatedCount }, `Berhasil memproses ${updatedCount} tarif`, 200);
  })
);

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.APP_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
      "Access-Control-Allow-Credentials": "true",
    },
  });
};
