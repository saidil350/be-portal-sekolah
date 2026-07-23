import { db } from './src/db';
import { sppInvoices, payments } from './src/db/schemas/payments';
import { tenants } from './src/db/schemas/tenants';
import { users } from './src/db/schemas/users';
import { eq } from 'drizzle-orm';
import { PaymentService } from './src/services/payment.service';

async function run() {
  try {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const userId = '22222222-2222-2222-2222-222222222222';
    const invoiceId = '11111111-1111-1111-1111-111111111111';
    
    // Insert if not exists
    await db.insert(tenants).values({ id: tenantId, name: 'Test Tenant', slug: 'test-tenant', domain: 'test' }).onConflictDoNothing();
    await db.insert(users).values({ id: userId, email: 'test@test.com', name: 'Test User', role: 'STUDENT', tenantId }).onConflictDoNothing();
    await db.insert(sppInvoices).values({ id: invoiceId, tenantId, studentId: userId, amount: 350000, month: 1, year: 2025, dueDate: new Date() }).onConflictDoNothing();
    
    await db.delete(payments).where(eq(payments.orderId, 'TEST-ORDER'));
    
    await db.insert(payments).values({
      tenantId,
      invoiceId,
      orderId: 'TEST-ORDER',
      amount: 350000,
      status: 'PENDING'
    });
    
    console.log('--- CALLING CHECK STATUS ---');
    const result = await PaymentService.checkStatus('TEST-ORDER', userId);
    console.log('--- RESULT ---', result);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
