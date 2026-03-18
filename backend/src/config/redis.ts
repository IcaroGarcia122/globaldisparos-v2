import IORedis from 'ioredis';
import logger from '../utils/logger';

let redisClient: IORedis | null = null;

export function getRedis(): IORedis | null {
  return redisClient;
}

export async function connectRedis(): Promise<void> {
  const host = process.env.REDIS_HOST;
  if (!host) {
    logger.warn('[Redis] REDIS_HOST não configurado — Redis desativado (sistema funciona sem Redis)');
    return;
  }

  try {
    redisClient = new IORedis({
      host: host.replace('localhost', '127.0.0.1'),
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    await redisClient.connect();
    await redisClient.ping();
    logger.info('[Redis] Conectado com sucesso');
  } catch (err: any) {
    logger.warn(`[Redis] Falha na conexão: ${err.message} — continuando sem Redis`);
    redisClient = null;
  }
}

// Cache simples em memória como fallback quando Redis não disponível
const memoryCache = new Map<string, { value: any; expires: number }>();

export const cache = {
  async get(key: string): Promise<any> {
    if (redisClient) {
      const val = await redisClient.get(key);
      return val ? JSON.parse(val) : null;
    }
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) { memoryCache.delete(key); return null; }
    return entry.value;
  },

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    if (redisClient) {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    }
    memoryCache.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  },

  async del(key: string): Promise<void> {
    if (redisClient) { await redisClient.del(key); return; }
    memoryCache.delete(key);
  },

  async keys(pattern: string): Promise<string[]> {
    if (redisClient) return redisClient.keys(pattern);
    const regex = new RegExp(pattern.replace('*', '.*'));
    return [...memoryCache.keys()].filter(k => regex.test(k));
  },
};
