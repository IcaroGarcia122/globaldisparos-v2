import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? [{ emit: 'event', level: 'query' }, 'error', 'warn']
    : ['error'],
});

if (process.env.NODE_ENV === 'development') {
  (prisma as any).$on('query', (e: any) => {
    if (process.env.LOG_QUERIES === 'true') {
      logger.debug(`[DB] ${e.query} (${e.duration}ms)`);
    }
  });
}

export async function connectDB(): Promise<void> {
  await prisma.$connect();
  logger.info('[DB] PostgreSQL conectado via Prisma');
}

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
}

export default prisma;
