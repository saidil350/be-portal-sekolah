import "dotenv/config";
import { db } from "./src/db/index.js";
import { sppInvoices, payments, users } from "./src/db/schema.js";
import { eq } from "drizzle-orm";

async function main() {
  const aditya = await db.query.users.findFirst({ where: eq(users.email, "siswa.putra@sekolah1.sch.id") });
  if (!aditya) {
    console.log("No aditya");
    process.exit(0);
  }
  const invs = await db.select().from(sppInvoices).where(eq(sppInvoices.studentId, aditya.id));
  console.log("Invoices:", invs);
  const pays = await db.select().from(payments).innerJoin(sppInvoices, eq(payments.invoiceId, sppInvoices.id)).where(eq(sppInvoices.studentId, aditya.id));
  console.log("Payments:", pays);
  process.exit(0);
}
main();
