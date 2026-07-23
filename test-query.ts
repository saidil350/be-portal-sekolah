import "dotenv/config";
import { db } from './src/db';
import { sppInvoices, payments } from './src/db/schema';
import { eq, and, sql } from 'drizzle-orm';

async function test() {
  const tenantId = "d3047576-ea29-476c-bf77-c8572392f378";

  console.log("Testing invoice list query...");
  try {
    const list = await db
      .select({
        id: sppInvoices.id,
        invoiceNumber: sppInvoices.invoiceNumber,
        status: sppInvoices.status,
      })
      .from(sppInvoices)
      .where(eq(sppInvoices.tenantId, tenantId))
      .orderBy(sql`${sppInvoices.createdAt} DESC`)
      .limit(10);
      
    console.log("Invoices found:", list.length);
    console.log(list);
  } catch (err) {
    console.error("Error in invoice query:", err);
  }

  process.exit(0);
}

test();
