import { NextRequest, NextResponse } from "next/server";

// Daftar origin yang diizinkan untuk CORS
const ALLOWED_ORIGINS = [
  process.env.APP_URL,                          // Dari environment variable (Render dashboard)
  "https://fe-portal-sekolah.vercel.app",       // Fallback hardcode URL Vercel production
  "http://localhost:3000",                       // Local development frontend
].filter(Boolean) as string[];

function getCorsHeaders(origin: string | null): Record<string, string> {
  // Cek apakah origin pengirim ada di whitelist
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0] ?? "http://localhost:3000";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");

  // Tangani preflight OPTIONS request — harus dibalas langsung di middleware
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }

  // Untuk semua request lain, lanjutkan ke route handler
  // tapi sertakan CORS headers di response
  const response = NextResponse.next();
  const corsHeaders = getCorsHeaders(origin);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

// Terapkan middleware hanya ke route /api/*
export const config = {
  matcher: "/api/:path*",
};
