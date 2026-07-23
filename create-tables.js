const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'CHARGEBACK', 'CHALLENGE', 'AUTHORIZED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS spp_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        student_id UUID NOT NULL REFERENCES users(id),
        invoice_number TEXT UNIQUE,
        amount INTEGER NOT NULL CHECK (amount > 0),
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        status payment_status DEFAULT 'PENDING' NOT NULL,
        due_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL,
        UNIQUE(student_id, month, year)
      );
    `);
    console.log('spp_invoices created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        invoice_id UUID NOT NULL REFERENCES spp_invoices(id),
        payment_number TEXT UNIQUE,
        order_id TEXT NOT NULL UNIQUE,
        amount INTEGER NOT NULL CHECK (amount > 0),
        payment_method TEXT,
        status payment_status DEFAULT 'PENDING' NOT NULL,
        snap_token TEXT,
        redirect_url TEXT,
        midtrans_transaction_id TEXT,
        paid_at TIMESTAMP,
        fraud_status TEXT,
        bank TEXT,
        payment_type TEXT,
        va_number TEXT,
        settlement_time TIMESTAMP,
        acquirer TEXT,
        issuer TEXT,
        channel_response_code TEXT,
        channel_response_message TEXT,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      );
    `);
    console.log('payments created');

  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}
run();
