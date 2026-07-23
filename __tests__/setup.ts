import { vi } from 'vitest';

// Mocking Pino Logger supaya tidak memenuhi console saat testing
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }
}));

// Mocking Midtrans Client
vi.mock('@/lib/midtrans', () => ({
  snap: {
    createTransaction: vi.fn().mockResolvedValue({
      token: 'mock-snap-token-123',
      redirect_url: 'https://app.midtrans.com/snap/v2/vtweb/mock-snap-token-123'
    })
  },
  coreApi: {
    transaction: {
      // Default: mengembalikan body notifikasi apa adanya (sesuai input).
      notification: vi.fn((n: any) => Promise.resolve(n)),
      status: vi.fn((orderId: string) =>
        Promise.resolve({
          order_id: orderId,
          transaction_status: 'settlement',
          fraud_status: 'accept',
          payment_type: 'qris',
          gross_amount: '100000.00',
          status_code: '200',
        })
      ),
    },
  },
}));

// Mock process.env
process.env.MIDTRANS_SERVER_KEY = 'mock-server-key';
