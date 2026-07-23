const { db } = require('./src/db');
const { sppInvoices, payments } = require('./src/db/schema');
const { eq } = require('drizzle-orm');

async function seed() {
  const tenantId = "d3047576-ea29-476c-bf77-c8572392f378"; // Tenant1 id from previous commands

  // Retrieve students for this tenant
  const { users } = require('./src/db/schema');
  const students = await db.select().from(users).where(eq(users.tenantId, tenantId)).execute();
  const siswaList = students.filter(u => u.role === "SISWA");

  if (siswaList.length === 0) {
    console.log("No students found");
    process.exit(1);
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  for (let i = 0; i < siswaList.length; i++) {
    const student = siswaList[i];
    
    // Create SPP invoice
    const invId = `inv-seed-${student.id.substring(0, 5)}-${Date.now()}`;
    const invoiceData = {
      tenantId,
      studentId: student.id,
      invoiceNumber: `INV-${currentYear}${currentMonth}-${student.id.substring(0,4)}`,
      amount: 500000,
      month: currentMonth,
      year: currentYear,
      status: i % 3 === 0 ? "PAID" : "PENDING",
      dueDate: new Date(currentYear, currentMonth - 1, 10),
    };

    const insertedInv = await db.insert(sppInvoices).values(invoiceData).returning().execute();

    if (invoiceData.status === "PAID") {
      const pId = `pay-seed-${student.id.substring(0, 5)}-${Date.now()}`;
      await db.insert(payments).values({
        tenantId,
        invoiceId: insertedInv[0].id,
        orderId: `ORDER-${insertedInv[0].id.substring(0,8)}`,
        amount: 500000,
        paymentMethod: "QRIS",
        paymentType: "qris",
        status: "PAID",
      }).execute();
    }
  }

  console.log("Seeding payments done!");
  process.exit(0);
}

seed().catch(console.error);
