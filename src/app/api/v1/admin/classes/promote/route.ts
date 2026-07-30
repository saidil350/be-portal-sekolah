import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse, errorResponse } from "@/utils/apiResponse";
import { withRole } from "@/middleware/rbacMiddleware";
import { db } from "@/db";
import { studentProfiles, studentClassHistory, classes, users } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

interface PromotionItem {
  studentId: string;
  action: "PROMOTE" | "RETAIN" | "GRADUATE";
  targetClassId?: string;
}

export const POST = withErrorHandler(
  withRole(["ADMIN_IT", "KEPALA_SEKOLAH"], async (req, _context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }

    const body = await req.json();
    const { fromClassId, toClassId, academicYearId, promotions } = body as {
      fromClassId: string;
      toClassId?: string;
      academicYearId: string;
      promotions: PromotionItem[];
    };

    if (!fromClassId || !academicYearId || !Array.isArray(promotions) || promotions.length === 0) {
      return errorResponse("Parameter fromClassId, academicYearId, dan daftar promotions wajib diisi", 400);
    }

    let processedCount = 0;

    await db.transaction(async (tx) => {
      for (const item of promotions) {
        const destinationClassId = item.targetClassId || toClassId;

        if (item.action === "PROMOTE" || item.action === "RETAIN") {
          if (!destinationClassId) {
            throw new Error(`Rombel tujuan tidak ditemukan untuk siswa ${item.studentId}`);
          }

          // 1. Update profil siswa
          await tx
            .update(studentProfiles)
            .set({ classId: destinationClassId, updatedAt: new Date() })
            .where(
              and(
                eq(studentProfiles.tenantId, tenantId),
                eq(studentProfiles.userId, item.studentId)
              )
            );

          // 2. Catat riwayat kelas
          await tx.insert(studentClassHistory).values({
            tenantId,
            studentId: item.studentId,
            classId: destinationClassId,
            academicYearId,
            status: item.action === "PROMOTE" ? "PROMOTED" : "RETAINED",
          });

          processedCount++;
        } else if (item.action === "GRADUATE") {
          // 1. Update profil siswa (hapus dari kelas)
          await tx
            .update(studentProfiles)
            .set({ classId: null, updatedAt: new Date() })
            .where(
              and(
                eq(studentProfiles.tenantId, tenantId),
                eq(studentProfiles.userId, item.studentId)
              )
            );

          // 2. Update status user jika perlu (tetap aktif/graduated)
          await tx
            .update(users)
            .set({ updatedAt: new Date() })
            .where(and(eq(users.tenantId, tenantId), eq(users.id, item.studentId)));

          // 3. Catat riwayat kelulusan
          await tx.insert(studentClassHistory).values({
            tenantId,
            studentId: item.studentId,
            classId: fromClassId,
            academicYearId,
            status: "GRADUATED",
          });

          processedCount++;
        }
      }
    });

    return successResponse(
      { processedCount },
      `Proses kenaikan kelas berhasil diproses untuk ${processedCount} siswa`
    );
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
