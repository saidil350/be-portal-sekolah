import type { NextConfig } from 'next';
import "./src/validations/env";

// Daftar origin yang diizinkan untuk CORS
// Dibaca saat build — pastikan APP_URL sudah di-set di environment Render sebelum deploy
const allowedOrigin =
  process.env.APP_URL ||
  "https://fe-portal-sekolah.vercel.app"; // fallback eksplisit ke URL Vercel

const nextConfig: NextConfig = {
  serverExternalPackages: ["@node-rs/argon2"],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: allowedOrigin },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Tenant-ID" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Vary", value: "Origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
