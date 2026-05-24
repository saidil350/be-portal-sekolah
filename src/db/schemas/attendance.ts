import { pgTable, text, timestamp, boolean, uuid, doublePrecision, date } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const attendanceRecords = pgTable("attendance_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  date: date("date").notNull(),
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),
  status: text("status").notNull(),
  notes: text("notes"),
  locationLatitude: doublePrecision("location_latitude"),
  locationLongitude: doublePrecision("location_longitude"),
  deviceInfo: text("device_info"),
  isRealtimeCheckedIn: boolean("is_realtime_checked_in").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
