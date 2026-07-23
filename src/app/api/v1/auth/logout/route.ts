import { NextRequest } from "next/server";
import { withErrorHandler } from "@/utils/apiHandler";
import { successResponse } from "@/utils/apiResponse";
import { withAuth } from "@/middleware/auth";
import { db } from "@/db";
import { session } from "@/db/schema";
import { eq } from "drizzle-orm";

export const POST = withErrorHandler(
  withAuth(async (req, context, authSession) => {
    // Delete the session from DB
    await db.delete(session).where(eq(session.id, authSession.session.id));

    return successResponse(null, "Logout berhasil");
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
