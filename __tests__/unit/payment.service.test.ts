import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService, mapMidtransStatus } from '@/services/payment.service';
import { db } from '@/db';
import crypto from 'crypto';
import { snap } from '@/lib/midtrans';

// Mock DB
vi.mock('@/db', () => ({
  db: {
    query: {
      sppInvoices: { findFirst: vi.fn() },
      users: { findFirst: vi.fn() },
      payments: { findFirst: vi.fn() }
    },
    insert: vi.fn().mockReturnValue({ values: vi.fn() }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) }),
    transaction: vi.fn((cb: any) => cb({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              for: vi.fn().mockResolvedValue([])
            })
          })
        })
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn() })
      })
    }))
  }
}));

describe('PaymentService Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mapMidtransStatus', () => {
    it('Harus mengembalikan PAID untuk settlement', () => {
      expect(mapMidtransStatus('settlement', 'accept', 'qris')).toBe('PAID');
    });

    it('BUG QRIS: capture TANPA fraud_status untuk qris harus PAID (bukan CHALLENGE)', () => {
      expect(mapMidtransStatus('capture', undefined, 'qris')).toBe('PAID');
      expect(mapMidtransStatus('capture', null, 'gopay')).toBe('PAID');
      expect(mapMidtransStatus('capture', undefined, 'shopeepay')).toBe('PAID');
    });

    it('capture TANPA fraud_status untuk kartu kredit biasa tetap CHALLENGE', () => {
      expect(mapMidtransStatus('capture', undefined, 'credit_card')).toBe('CHALLENGE');
    });

    it('capture dengan fraud_status accept -> PAID', () => {
      expect(mapMidtransStatus('capture', 'accept', 'credit_card')).toBe('PAID');
    });

    it('Harus memetakan status terminal lain dengan benar', () => {
      expect(mapMidtransStatus('cancel', undefined, 'qris')).toBe('CANCELLED');
      expect(mapMidtransStatus('deny', undefined, 'qris')).toBe('FAILED');
      expect(mapMidtransStatus('expire', undefined, 'qris')).toBe('PENDING');
      expect(mapMidtransStatus('pending', undefined, 'qris')).toBe('PENDING');
    });
  });

  describe('createPayment', () => {
    it('Harus melempar error jika invoice tidak ditemukan', async () => {
      vi.mocked(db.query.sppInvoices.findFirst).mockResolvedValueOnce(null);
      await expect(PaymentService.createPayment('inv-123', 'user-1')).rejects.toThrow('Invoice tidak ditemukan');
    });

    it('Harus melempar error jika invoice sudah dibayar', async () => {
      vi.mocked(db.query.sppInvoices.findFirst).mockResolvedValueOnce({ id: 'inv-1', status: 'PAID' } as any);
      await expect(PaymentService.createPayment('inv-1', 'user-1')).rejects.toThrow('Invoice sudah dibayar');
    });

    it('Harus me-reuse token jika ada transaksi pending', async () => {
      vi.mocked(db.query.sppInvoices.findFirst).mockResolvedValueOnce({ id: 'inv-1', status: 'PENDING', amount: 100000 } as any);
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ id: 'user-1' } as any);
      
      const twoDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString();
      vi.mocked(db.query.payments.findFirst).mockResolvedValueOnce({ 
        id: 'pay-1', 
        status: 'PENDING', 
        createdAt: twoDaysAgo,
        snapToken: 'reused-token-123',
        redirectUrl: 'url-reuse'
      } as any);

      const result = await PaymentService.createPayment('inv-1', 'user-1');
      expect(result.token).toBe('reused-token-123');
      expect(snap.createTransaction).not.toHaveBeenCalled(); // Jangan panggil Midtrans API lagi
    });
  });

  describe('handleWebhook', () => {
    it('Harus melempar error Invalid Signature', async () => {
      const mockNotification = {
        order_id: 'SPP-123',
        status_code: '200',
        gross_amount: '100000.00',
        signature_key: 'invalid-sig',
      };
      await expect(PaymentService.handleWebhook(mockNotification)).rejects.toThrow('Invalid signature');
    });

    it('Harus memproses webhook secara aman (Race Condition Prevention via Tx)', async () => {
      // Mock valid signature
      const serverKey = 'mock-server-key';
      const hash = crypto.createHash("sha512").update(`SPP-123200100000.00${serverKey}`).digest("hex");
      
      const mockNotification = {
        order_id: 'SPP-123',
        status_code: '200',
        gross_amount: '100000.00',
        signature_key: hash,
        transaction_status: 'capture',
        fraud_status: 'accept',
      };

      // Mock DB Transaction return payment
      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        const txMock = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  for: vi.fn().mockResolvedValue([{
                    id: 'pay-1',
                    orderId: 'SPP-123',
                    amount: 100000,
                    status: 'PENDING',
                    invoiceId: 'inv-1'
                  }])
                })
              })
            })
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({ where: vi.fn() })
          })
        };
        return cb(txMock as any);
      });

      const result = await PaymentService.handleWebhook(mockNotification);
      expect(result.success).toBe(true);
    });
  });
});
