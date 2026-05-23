import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url("Format DATABASE_URL tidak valid"),
  REDIS_URL: z.string().url("Format REDIS_URL tidak valid").optional(),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET harus diisi"),
  BETTER_AUTH_URL: z.string().url("Format BETTER_AUTH_URL tidak valid"),
  MIDTRANS_SERVER_KEY: z.string().optional(),
  MIDTRANS_CLIENT_KEY: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Variabel environment tidak valid:", _env.error.format());
  throw new Error("Variabel environment tidak valid. Silakan cek file .env Anda.");
}

export const env = _env.data;
