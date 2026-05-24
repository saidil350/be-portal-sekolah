import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { classes } from "./classes";
import { users } from "./users";

export const classEnrollments = pgTable("class_enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id").references(() => classes.id).notNull(),
  studentId: uuid("student_id").references(() => users.id).notNull(),
  academicYear: text("academic_year").notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
