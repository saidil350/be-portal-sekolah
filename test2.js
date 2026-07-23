const { Client } = require('pg');
const client = new Client('postgresql://postgres:admin123@localhost:5432/portal_sekolah?schema=public');
client.connect()
  .then(() => client.query(`SELECT status, count(*) FROM spp_invoices WHERE tenant_id = 'd3047576-ea29-476c-bf77-c8572392f378' GROUP BY status;`))
  .then(res => {
    console.table(res.rows);
    return client.query(`SELECT * FROM spp_invoices WHERE tenant_id = 'd3047576-ea29-476c-bf77-c8572392f378' LIMIT 5;`);
  })
  .then(res => {
    console.table(res.rows);
    client.end();
  })
  .catch(err => {
    console.error(err);
    client.end();
  });
