import { NextRequest } from "next/server";
import { AuthSession, withAuth } from "./auth";
import { errorResponse } from "@/utils/apiResponse";
import { ResolvedContext } from "@/utils/apiHandler";

type HandlerFn = (
  req: NextRequest,
  context: ResolvedContext,
  authSession: AuthSession
) => Promise<Response> | Response;

export const withRole = (roles: string[], handler: HandlerFn) => {
  return withAuth(async (req, context, authSession) => {
    const userRole = authSession.user.role;
    if (!roles.includes(userRole)) {
      return errorResponse("Forbidden: Insufficient privileges", 403);
    }
    return handler(req, context, authSession);
  });
};

export const withTenant = (handler: HandlerFn) => {
  return withAuth(async (req, context, authSession) => {
    const tenantId = authSession.user.tenantId;
    if (!tenantId) {
      return errorResponse("Tenant context missing", 400);
    }
    return handler(req, context, authSession);
  });
};
