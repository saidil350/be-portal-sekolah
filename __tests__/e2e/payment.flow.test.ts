import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as CreatePayment } from '@/app/api/v1/payments/create/route';
import { POST as Webhook } from '@/app/api/v1/payments/webhook/route';
import { auth } from '@/lib/auth';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

// Gunakan spy / mock parsial pada Service / DB tidak perlu, kita tes full logical flow tapi dengan mock DB di level query supaya tidak hit DB sungguhan
// Tapi e2e sesungguhnya butuh setup test DB. Karena setup DB test cukup berat di lingkungan tanpa docker-compose ini, kita akan mock perilaku query dengan state buatan in-memory.

let memoryDB: any = {
  invoices: [
    { id: '11111111-1111-1111-1111-111111111111', studentId: 'user-1', amount: 150000, status: 'PENDING' }
  ],
  payments: []
};

// Override mock setup.ts dengan in-memory state
vi.mock('@/db', () => ({
  db: {
    query: {
      sppInvoices: { 
        findFirst: vi.fn().mockImplementation(async ({ where }) => memoryDB.invoices[0]) 
      },
      users: { 
        findFirst: vi.fn().mockResolvedValue({ id: 'user-1', name: 'Test', email: 'test@a.com' }) 
      },
      payments: { 
        findFirst: vi.fn().mockImplementation(async () => memoryDB.payments.length > 0 ? memoryDB.payments[0] : null) 
      }
    },
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((val) => {
        memoryDB.payments.unshift({ ...val, id: 'pay-uuid', createdAt: new Date() });
      })
    })),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) }),
    transaction: vi.fn(async (cb) => {
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                for: vi.fn().mockResolvedValue([memoryDB.payments[0]])
              })
            })
          })
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((updateData) => {
            memoryDB.payments[0] = { ...memoryDB.payments[0], ...updateData };
            return { where: vi.fn() };
          })
        }),
        insert: vi.fn().mockReturnValue({ values: vi.fn() })
      };
      return await cb(txMock);
    })
  }
}));

describe('E2E Flow - Payment Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoryDB.payments = [];
  });

  it('Skenario Lengkap: Create Payment -> Webhook Sukses (PAID)', async () => {
    // 1. User minta bayar
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: 'user-1' } } as any);
    
    const reqCreate = new NextRequest('http://localhost/api/v1/payments/create', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: '11111111-1111-1111-1111-111111111111' }) 
    });

    const resCreate = await CreatePayment(reqCreate);
    const createData = await resCreate.json();
    
    expect(createData.success).toBe(true);
    expect(memoryDB.payments.length).toBe(1);
    expect(memoryDB.payments[0].status).toBe('PENDING');

    // 2. Midtrans mengirim Webhook Sukses
    const orderId = memoryDB.payments[0].orderId;
    const serverKey = 'mock-server-key';
    const hash = crypto.createHash("sha512").update(`${orderId}200150000.00${serverKey}`).digest("hex");

    const reqWebhook = new NextRequest('http://localhost/api/v1/payments/webhook', {
      method: 'POST',
      body: JSON.stringify({
        order_id: orderId,
        status_code: '200',
        gross_amount: '150000.00',
        signature_key: hash,
        transaction_status: 'settlement'
      })
    });

    const resWebhook = await Webhook(reqWebhook);
    const webhookData = await resWebhook.json();

    expect(webhookData.success).toBe(true);
    // Cek in-memory
    expect(memoryDB.payments[0].status).toBe('PAID');
  });

  it('Skenario: Webhook Cancel', async () => {
    // Inject payment pending
    memoryDB.payments = [{
      id: 'pay-2', orderId: 'SPP-2', amount: 150000, status: 'PENDING', invoiceId: 'inv-2'
    }];

    const orderId = 'SPP-2';
    const serverKey = 'mock-server-key';
    const hash = crypto.createHash("sha512").update(`${orderId}200150000.00${serverKey}`).digest("hex");

    const reqWebhook = new NextRequest('http://localhost/api/v1/payments/webhook', {
      method: 'POST',
      body: JSON.stringify({
        order_id: orderId,
        status_code: '200',
        gross_amount: '150000.00',
        signature_key: hash,
        transaction_status: 'cancel'
      })
    });

    await Webhook(reqWebhook);
    expect(memoryDB.payments[0].status).toBe('FAILED');
  });

  it('Skenario: Duplicate Callback (Idempotent)', async () => {
    // Status sudah PAID
    memoryDB.payments = [{
      id: 'pay-3', orderId: 'SPP-3', amount: 150000, status: 'PAID', invoiceId: 'inv-3'
    }];

    const hash = crypto.createHash("sha512").update(`SPP-3200150000.00mock-server-key`).digest("hex");

    const reqWebhook = new NextRequest('http://localhost/api/v1/payments/webhook', {
      method: 'POST',
      body: JSON.stringify({
        order_id: 'SPP-3', status_code: '200', gross_amount: '150000.00', signature_key: hash, transaction_status: 'settlement'
      })
    });

    const res = await Webhook(reqWebhook);
    const data = await res.json();
    expect(data.success).toBe(true);
    // Tidak akan error walau dikirim berkali-kali
  });
});
