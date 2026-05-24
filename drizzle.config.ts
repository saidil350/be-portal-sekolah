import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load .env if exists, or point to .env.example fallback for schema gen if needed
dotenv.config({ path: ".env" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Drizzle Studio is only the UI; the actual database connection still comes from DATABASE_URL.
    url: process.env.DATABASE_URL || "postgresql://postgres:password123@localhost:5432/portal_sekolah?schema=public",
  },
  verbose: true,
  strict: true,
});
