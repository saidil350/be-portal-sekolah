import Redis from 'ioredis';
import { logger } from '@/logging';

// Redis dinonaktifkan - tidak dipakai di flow pembayaran maupun fitur lainnya.
// Uncomment dan set REDIS_URL di .env jika ingin mengaktifkan kembali.
const redisUrl = process.env.REDIS_URL;

class RedisClient {
  private static instance: Redis | null = null;

  public static getInstance(): Redis | null {
    // Jika REDIS_URL tidak diset, jangan coba konek
    if (!redisUrl) {
      return null;
    }

    if (!RedisClient.instance) {
      RedisClient.instance = new Redis(redisUrl, {
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      RedisClient.instance.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      RedisClient.instance.on('error', (err) => {
        logger.error({ err }, 'Redis connection error');
      });
    }

    return RedisClient.instance;
  }
}

export const redis = RedisClient.getInstance();

