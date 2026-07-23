import { pgTable, text, timestamp, uuid, integer, pgEnum, unique, check, boolean } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";
import { sql } from "drizzle-orm";

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
  "CHARGEBACK",
  "CHALLENGE",
  "AUTHORIZED",
]);

export const sppTariffs = pgTable("spp_tariffs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  academicYear: text("academic_year").notNull(),
  grade: text("grade"),
  class: text("class"),
  studentId: uuid("student_id").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sppInvoices = pgTable("spp_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  studentId: uuid("student_id").references(() => users.id).notNull(),
  invoiceNumber: text("invoice_number").unique(),
  amount: integer("amount").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  status: paymentStatusEnum("status").default("PENDING").notNull(),
  dueDate: timestamp("due_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    amountCheck: check("spp_invoices_amount_check", sql`${table.amount} > 0`),
    uniquePeriod: unique("unique_student_period").on(table.studentId, table.month, table.year),
  };
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  invoiceId: uuid("invoice_id").references(() => sppInvoices.id).notNull(),
  paymentNumber: text("payment_number").unique(),
  orderId: text("order_id").notNull().unique(), // Untuk Midtrans order_id
  amount: integer("amount").notNull(),
  paymentMethod: text("payment_method"),
  status: paymentStatusEnum("status").default("PENDING").notNull(),
  snapToken: text("snap_token"),
  redirectUrl: text("redirect_url"),
  midtransTransactionId: text("midtrans_transaction_id"),
  paidAt: timestamp("paid_at"),
  fraudStatus: text("fraud_status"),
  bank: text("bank"),
  paymentType: text("payment_type"),
  vaNumber: text("va_number"),
  settlementTime: timestamp("settlement_time"),
  acquirer: text("acquirer"),
  issuer: text("issuer"),
  channelResponseCode: text("channel_response_code"),
  channelResponseMessage: text("channel_response_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    amountCheck: check("payments_amount_check", sql`${table.amount} > 0`),
  };
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id), // Opsional, bisa null kalau system log
  actionType: text("action_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: text("metadata"), // Disimpan sebagai text stringified JSON
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
