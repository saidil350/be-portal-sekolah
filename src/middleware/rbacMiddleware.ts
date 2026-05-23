import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse } from "@/utils/apiResponse";

export const withRole = (roles: string[], handler: Function) => {
  return async (req: NextRequest, context: any) => {
    try {
      const session = await auth.api.getSession({ headers: req.headers });
      
      if (!session || !session.user) {
        return errorResponse("Unauthorized", 401);
      }

      // Pastikan custom property "role" ada di type session.user
      const userRole = (session.user as any).role;

      if (!roles.includes(userRole)) {
        return errorResponse("Forbidden: Insufficient privileges", 403);
      }

      return handler(req, context, session);
    } catch (error) {
      return errorResponse("Internal Server Error", 500, error);
    }
  };
};

export const withTenant = (handler: Function) => {
  return async (req: NextRequest, context: any) => {
    try {
      const session = await auth.api.getSession({ headers: req.headers });
      
      if (!session || !session.user) {
        return errorResponse("Unauthorized", 401);
      }

      const tenantId = (session.user as any).tenantId;

      if (!tenantId) {
        return errorResponse("Tenant context missing", 400);
      }

      return handler(req, context, session);
    } catch (error) {
      return errorResponse("Internal Server Error", 500, error);
    }
  };
};
