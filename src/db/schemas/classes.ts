import { pgTable, text, timestamp, integer, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  gradeLevel: integer("grade_level").notNull(),
  homeroomTeacherId: uuid("homeroom_teacher_id").references(() => users.id),
  academicYear: text("academic_year").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
