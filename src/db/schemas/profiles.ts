import { pgTable, text, timestamp, boolean, uuid, date } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const studentProfiles = pgTable("student_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  nis: text("nis").notNull(),
  nisn: text("nisn"),
  gender: text("gender").notNull(),
  birthPlace: text("birth_place"),
  birthDate: date("birth_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const teacherProfiles = pgTable("teacher_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  nip: text("nip"),
  gender: text("gender").notNull(),
  subjectArea: text("subject_area").array(),
  isHomeroom: boolean("is_homeroom").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
