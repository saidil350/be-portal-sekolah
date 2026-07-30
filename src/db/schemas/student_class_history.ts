import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";
import { classes } from "./classes";
import { academicYears } from "./academic_years";

export const studentClassHistory = pgTable("student_class_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  studentId: uuid("student_id").references(() => users.id).notNull(),
  classId: uuid("class_id").references(() => classes.id).notNull(),
  academicYearId: uuid("academic_year_id").references(() => academicYears.id).notNull(),
  status: text("status").notNull().default("PROMOTED"), // "PROMOTED", "RETAINED", "GRADUATED"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
