import dotenv from 'dotenv';
dotenv.config();

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sppInvoices, payments, users } from './src/db/schema';
import { sql } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function checkDb() {
  try {
    const inv = await db.select({ count: sql`count(*)` }).from(sppInvoices);
    const pay = await db.select({ count: sql`count(*)` }).from(payments);
    const usr = await db.select({ count: sql`count(*)` }).from(users);

    const paidInvoices = await db.select({ count: sql`count(*)` }).from(sppInvoices).where(sql`status = 'PAID'`);
    const pendingInvoices = await db.select({ count: sql`count(*)` }).from(sppInvoices).where(sql`status = 'PENDING'`);
    const sumPending = await db.select({ sum: sql`COALESCE(SUM(amount), 0)` }).from(sppInvoices).where(sql`status = 'PENDING'`);

    const invoiceSample = await db.select({
      id: sppInvoices.id,
      invoiceNumber: sppInvoices.invoiceNumber,
      amount: sppInvoices.amount,
      tenantId: sppInvoices.tenantId,
      status: sppInvoices.status
    }).from(sppInvoices).limit(5);

    const paymentSample = await db.select({
      id: payments.id,
      orderId: payments.orderId,
      amount: payments.amount,
      status: payments.status,
      paymentMethod: payments.paymentMethod,
      tenantId: payments.tenantId
    }).from(payments).limit(5);

    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    
    console.log("=== DB TABLES IN PUBLIC SCHEMA ===");
    console.log(tables.rows.map(r => r.table_name));

    console.log("=== DB REALITY CHECK RESULT ===");
    console.log("Total Invoices in DB:", Number(inv[0].count));
    console.log("PAID Invoices in DB:", Number(paidInvoices[0].count));
    console.log("PENDING Invoices in DB:", Number(pendingInvoices[0].count));
    console.log("Total Outstanding Amount in DB:", Number(sumPending[0].sum));
    console.log("Total Payments in DB:", Number(pay[0].count));
    console.log("Total Users in DB:", Number(usr[0].count));
    console.log("Invoice Samples:", JSON.stringify(invoiceSample));
    console.log("Payment Samples:", JSON.stringify(paymentSample));
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkDb();
