import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "../db";
import * as schema from "../db/schema";

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: [
        process.env.APP_URL,
        "https://fe-portal-sekolah.vercel.app",
        "http://localhost:3000"
    ].filter(Boolean) as string[],
    database: drizzleAdapter(db, {
        provider: "pg", // or "mysql", "sqlite"
        schema: {
            ...schema,
            user: schema.users
        }
    }),
    emailAndPassword: {
        enabled: true,
    },
    // tambahkan modul/konfigurasi tenant atau custom sessions sesuai kebutuhan
});
