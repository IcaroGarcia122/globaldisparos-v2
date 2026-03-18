import { Queue, Worker, QueueEvents } from 'bullmq';
import { getRedis } from './redis';
import logger from '../utils/logger';

// Nomes das filas
export const QUEUES = {
  SEND_MESSAGES: 'send-messages',
  SEND_MEDIA: 'send-media',
  WEBHOOKS: 'webhooks',
  SCHEDULER: 'scheduler',
} as const;

// Instâncias das filas (lazy — criadas só se Redis disponível)
const queues = new Map<string, Queue>();

export function getQueue(name: string): Queue | null {
  const redis = getRedis();
  if (!redis) return null;

  if (!queues.has(name)) {
    const q = new Queue(name, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
    queues.set(name, q);
  }
  return queues.get(name)!;
}

export async function closeAllQueues(): Promise<void> {
  for (const [name, q] of queues) {
    await q.close();
    logger.info(`[Queue] ${name} fechada`);
  }
  queues.clear();
}

export { Queue, Worker, QueueEvents };
