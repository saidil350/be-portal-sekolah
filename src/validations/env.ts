import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url("Format DATABASE_URL tidak valid"),
  REDIS_URL: z.string().url("Format REDIS_URL tidak valid").optional(),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET harus diisi"),
  BETTER_AUTH_URL: z.string().url("Format BETTER_AUTH_URL tidak valid"),
  APP_URL: z.string().url("Format APP_URL tidak valid"),
  WEBHOOK_URL: z.string().url("Format WEBHOOK_URL tidak valid").optional(),
  MIDTRANS_NOTIFICATION_URL: z.string().url("Format MIDTRANS_NOTIFICATION_URL tidak valid").optional(),
  MIDTRANS_SERVER_KEY: z.string().min(1, "MIDTRANS_SERVER_KEY harus diisi"),
  MIDTRANS_CLIENT_KEY: z.string().min(1, "MIDTRANS_CLIENT_KEY harus diisi"),
  MIDTRANS_IS_PRODUCTION: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"), // true = produksi, false = sandbox. Mencegah mismatch yang menyebabkan signature gagal.
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Variabel environment tidak valid:", _env.error.format());
  throw new Error("Variabel environment tidak valid. Silakan cek file .env Anda.");
}

const resolvedWebhookUrl = _env.data.WEBHOOK_URL || _env.data.MIDTRANS_NOTIFICATION_URL;

export const env = {
  ..._env.data,
  WEBHOOK_URL: resolvedWebhookUrl,
};
