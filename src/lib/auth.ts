import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "../db";
import * as schema from "../db/schema";

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: process.env.APP_URL ? [process.env.APP_URL] : [],
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
