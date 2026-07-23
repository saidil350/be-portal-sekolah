const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'").then(res => {
  console.log('Tables:', res.rows.map(r => r.table_name).join(', '));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
