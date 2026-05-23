import { pgTable, text, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  password: text("password"),
  role: text("role").default("user").notNull(), // admin, teacher, student, user dll.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
