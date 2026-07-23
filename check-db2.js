const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query("SELECT * FROM invoices LIMIT 1");
    console.log('invoices columns:', res.fields.map(f => f.name).join(', '));
    
    // Also try to query spp_invoices to see if it fails
    try {
      await pool.query("SELECT * FROM spp_invoices LIMIT 1");
      console.log('spp_invoices table exists!');
    } catch (e) {
      console.log('spp_invoices error:', e.message);
    }
  } catch (err) {
    console.error('invoices error:', err.message);
  }
  process.exit(0);
}
run();
