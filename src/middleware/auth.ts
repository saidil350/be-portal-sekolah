import { NextRequest } from "next/server";
import { db } from "@/db";
import { session, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { UnauthorizedError } from "@/utils/AppError";
import { ResolvedContext } from "@/utils/apiHandler";

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    id: string;
    token: string;
    expiresAt: Date;
    userId: string;
  };
}

export async function getSessionFromRequest(req: NextRequest): Promise<AuthSession> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Token tidak ditemukan. Silakan login kembali.");
  }

  const token = authHeader.replace("Bearer ", "");

  const result = await db
    .select({
      session: session,
      user: users,
    })
    .from(session)
    .innerJoin(users, eq(session.userId, users.id))
    .where(eq(session.token, token))
    .limit(1);

  if (!result.length) {
    throw new UnauthorizedError("Sesi tidak valid. Silakan login kembali.");
  }

  const { session: sess, user } = result[0];

  if (new Date(sess.expiresAt) < new Date()) {
    throw new UnauthorizedError("Sesi telah kadaluarsa. Silakan login kembali.");
  }

  if (!user.isActive) {
    throw new UnauthorizedError("Akun telah dinonaktifkan.");
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      avatarUrl: user.image,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    session: {
      id: sess.id,
      token: sess.token,
      expiresAt: sess.expiresAt,
      userId: sess.userId,
    },
  };
}

type AuthenticatedHandler = (
  req: NextRequest,
  context: ResolvedContext,
  authSession: AuthSession
) => Promise<Response> | Response;

export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextRequest, context: ResolvedContext) => {
    const authSession = await getSessionFromRequest(req);
    return handler(req, context, authSession);
  };
}
