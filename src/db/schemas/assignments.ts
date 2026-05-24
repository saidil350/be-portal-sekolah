import { pgTable, text, timestamp, integer, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";
import { classes } from "./classes";

export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  classId: uuid("class_id").references(() => classes.id).notNull(),
  teacherId: uuid("teacher_id").references(() => users.id).notNull(),
  dueDate: timestamp("due_date").notNull(),
  maxScore: integer("max_score").notNull(),
  attachments: text("attachments").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  assignmentId: uuid("assignment_id").references(() => assignments.id).notNull(),
  studentId: uuid("student_id").references(() => users.id).notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  attachments: text("attachments").array().notNull(),
  notes: text("notes"),
  score: integer("score"),
  gradedBy: uuid("graded_by").references(() => users.id),
  gradedAt: timestamp("graded_at"),
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
