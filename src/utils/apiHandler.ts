import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "./apiResponse";
import { AppError } from "./AppError";
import { logger } from "@/logging";
import { z } from "zod";

export type ResolvedContext = { params: Record<string, string> };
type ApiHandlerFunction = (req: NextRequest, context: ResolvedContext) => Promise<Response | NextResponse> | Response | NextResponse;

export const withErrorHandler = (handler: ApiHandlerFunction) => {
  return async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    try {
      const params = await context.params;
      return await handler(req, { params });
    } catch (error: any) {
      logger.error({ err: error }, `API Error on ${req.method} ${req.url}`);

      if (error instanceof AppError) {
        return errorResponse(error.message, error.statusCode);
      }

      if (error instanceof z.ZodError) {
        return errorResponse("Validation Error", 400, error.errors);
      }

      return errorResponse("Internal Server Error", 500, process.env.NODE_ENV === 'development' ? error.message : undefined);
    }
  };
};
