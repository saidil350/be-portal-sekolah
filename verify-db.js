const { Client } = require('pg');
const client = new Client('postgresql://postgres:admin123@localhost:5432/portal_sekolah?schema=public');
async function run() {
  await client.connect();
  const paymentRes = await client.query("SELECT status, invoice_id FROM payments WHERE order_id='TEST-ORDER'");
  console.log('--- PAYMENTS ---');
  console.log(paymentRes.rows);
  
  if (paymentRes.rows.length > 0) {
    const invoiceId = paymentRes.rows[0].invoice_id;
    const invoiceRes = await client.query("SELECT status FROM spp_invoices WHERE id=$1", [invoiceId]);
    console.log('--- SPP_INVOICES ---');
    console.log(invoiceRes.rows);
  }
  
  const auditRes = await client.query("SELECT action_type, entity_id, metadata FROM audit_logs ORDER BY created_at DESC LIMIT 5");
  console.log('--- AUDIT_LOGS ---');
  console.log(auditRes.rows);
  
  await client.end();
}
run().catch(console.error);
