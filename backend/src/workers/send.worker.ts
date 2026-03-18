/**
 * Worker de envio de mensagens — processa jobs da fila send-messages
 * Roda como processo separado para não bloquear o servidor HTTP
 */

import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { getRedis } from '../config/redis';
import { QUEUES } from '../config/queue';
import prisma from '../config/database';
import whatsappService from '../services/whatsapp.service';
import antiBanService from '../services/antiban.service';
import logger from '../utils/logger';

export interface SendMessageJob {
  campaignId: number;
  instanceName: string;
  phoneNumber: string;
  message: string;
  contactName?: string;
  userId: number;
  totalContacts: number;
  contactIndex: number;
  intervalMs: number;
}

async function processJob(job: Job<SendMessageJob>) {
  const { campaignId, instanceName, phoneNumber, message, contactName, userId, totalContacts, contactIndex, intervalMs } = job.data;

  logger.debug(`[Worker] Job ${job.id}: enviando para ${phoneNumber} (campanha ${campaignId})`);

  // Verificar se campanha ainda está ativa
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });

  if (!campaign || campaign.status === 'cancelled' || campaign.status === 'completed') {
    logger.info(`[Worker] Campanha ${campaignId} encerrada — job ignorado`);
    return { skipped: true };
  }

  // Aguardar se pausada
  if (campaign.status === 'paused') {
    let paused = true;
    while (paused) {
      await new Promise(r => setTimeout(r, 5000));
      const check = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
      paused = check?.status === 'paused';
    }
  }

  // Personalizar mensagem
  const personalizedMsg = message
    .replace(/{nome}/g, contactName || 'Amigo')
    .replace(/{numero}/g, phoneNumber);

  let success = false;
  try {
    await whatsappService.sendText(instanceName, phoneNumber, personalizedMsg);
    success = true;

    await prisma.whatsAppInstance.update({
      where: { name: instanceName },
      data: { totalMessagesSent: { increment: 1 }, dailyMessagesSent: { increment: 1 }, lastMessageAt: new Date() },
    }).catch(() => {});
  } catch (err: any) {
    logger.warn(`[Worker] Falha ao enviar para ${phoneNumber}: ${err.message}`);

    await prisma.whatsAppInstance.update({
      where: { name: instanceName },
      data: { totalMessagesFailed: { increment: 1 } },
    }).catch(() => {});
  }

  // Atualizar contador da campanha
  await prisma.campaign.update({
    where: { id: campaignId },
    data: success
      ? { messagesSent: { increment: 1 } }
      : { messagesFailed: { increment: 1 } },
  });

  // Delay anti-ban entre mensagens
  if (contactIndex < totalContacts - 1) {
    await antiBanService.applyDelay(instanceName, contactIndex, intervalMs);
  }

  return { success, phoneNumber };
}

// Inicia o worker apenas se Redis disponível
async function startWorker() {
  const { connectRedis } = await import('../config/redis');
  await connectRedis();

  const redis = getRedis();
  if (!redis) {
    logger.warn('[Worker] Redis não disponível — worker não iniciado');
    return;
  }

  const worker = new Worker(QUEUES.SEND_MESSAGES, processJob, {
    connection: redis,
    concurrency: 2, // 2 jobs simultâneos por worker
  });

  worker.on('completed', (job) => {
    logger.debug(`[Worker] Job ${job.id} completo`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[Worker] Job ${job?.id} falhou: ${err.message}`);
  });

  logger.info('[Worker] send.worker iniciado');

  process.on('SIGTERM', async () => {
    await worker.close();
    process.exit(0);
  });
}

startWorker().catch(logger.error);
