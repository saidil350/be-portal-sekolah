import { pgTable, uuid, text, boolean, timestamp, integer, date } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const academicYears = pgTable("academic_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(), // Contoh: "2025/2026"
  semester: integer("semester").notNull().default(1), // 1 = Ganjil, 2 = Genap
  isCurrent: boolean("is_current").default(false).notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
