import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as CreatePayment } from '@/app/api/v1/payments/create/route';
import { POST as Webhook } from '@/app/api/v1/payments/webhook/route';
import { auth } from '@/lib/auth';
import { PaymentService } from '@/services/payment.service';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn()
    }
  }
}));

vi.mock('@/services/payment.service', () => ({
  PaymentService: {
    createPayment: vi.fn(),
    handleWebhook: vi.fn()
  }
}));

describe('Integration Tests - API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('/api/v1/payments/create', () => {
    it('Harus merespon 401 jika user tidak terautentikasi', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);
      
      const req = new NextRequest('http://localhost/api/v1/payments/create', {
        method: 'POST',
        body: JSON.stringify({ invoiceId: '123' })
      });

      const res = await CreatePayment(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.message).toBe('Unauthorized');
    });

    it('Harus merespon 400 jika payload tidak valid (Zod validation)', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: 'user-1' } } as any);
      
      const req = new NextRequest('http://localhost/api/v1/payments/create', {
        method: 'POST',
        body: JSON.stringify({ invoiceId: 'bukan-uuid' }) // Zod mengharapkan UUID
      });

      const res = await CreatePayment(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toBe('Validation error');
    });

    it('Harus sukses memanggil service', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: 'user-1' } } as any);
      vi.mocked(PaymentService.createPayment).mockResolvedValueOnce({ token: 'tok', redirectUrl: 'url' });
      
      // Menggunakan UUID valid
      const req = new NextRequest('http://localhost/api/v1/payments/create', {
        method: 'POST',
        body: JSON.stringify({ invoiceId: '550e8400-e29b-41d4-a716-446655440000' }) 
      });

      const res = await CreatePayment(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.token).toBe('tok');
    });
  });

  describe('/api/v1/payments/webhook', () => {
    it('Harus mengembalikan success true walaupun handleWebhook throw error (supaya Midtrans tidak spam)', async () => {
      vi.mocked(PaymentService.handleWebhook).mockRejectedValueOnce(new Error('Invalid signature'));
      
      const req = new NextRequest('http://localhost/api/v1/payments/webhook', {
        method: 'POST',
        body: JSON.stringify({ order_id: 'test' })
      });

      const res = await Webhook(req);
      expect(res.status).toBe(200); // Harus selalu 200
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Invalid signature');
    });
  });
});
