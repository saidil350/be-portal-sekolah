import Redis from 'ioredis';
import { logger } from '@/logging';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

class RedisClient {
  private static instance: Redis;

  public static getInstance(): Redis {
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
