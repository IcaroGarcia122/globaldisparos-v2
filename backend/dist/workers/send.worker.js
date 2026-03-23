"use strict";
/**
 * Worker de envio de mensagens — processa jobs da fila send-messages
 * Roda como processo separado para não bloquear o servidor HTTP
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const queue_1 = require("../config/queue");
const database_1 = __importDefault(require("../config/database"));
const whatsapp_service_1 = __importDefault(require("../services/whatsapp.service"));
const antiban_service_1 = __importDefault(require("../services/antiban.service"));
const logger_1 = __importDefault(require("../utils/logger"));
async function processJob(job) {
    const { campaignId, instanceName, phoneNumber, message, contactName, userId, totalContacts, contactIndex, intervalMs } = job.data;
    logger_1.default.debug(`[Worker] Job ${job.id}: enviando para ${phoneNumber} (campanha ${campaignId})`);
    // Verificar se campanha ainda está ativa
    const campaign = await database_1.default.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
    });
    if (!campaign || campaign.status === 'cancelled' || campaign.status === 'completed') {
        logger_1.default.info(`[Worker] Campanha ${campaignId} encerrada — job ignorado`);
        return { skipped: true };
    }
    // Aguardar se pausada
    if (campaign.status === 'paused') {
        let paused = true;
        while (paused) {
            await new Promise(r => setTimeout(r, 5000));
            const check = await database_1.default.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
            paused = check?.status === 'paused';
        }
    }
    // Personalizar mensagem
    const personalizedMsg = message
        .replace(/{nome}/g, contactName || 'Amigo')
        .replace(/{numero}/g, phoneNumber);
    let success = false;
    try {
        await whatsapp_service_1.default.sendText(instanceName, phoneNumber, personalizedMsg);
        success = true;
        await database_1.default.whatsAppInstance.update({
            where: { name: instanceName },
            data: { totalMessagesSent: { increment: 1 }, dailyMessagesSent: { increment: 1 }, lastMessageAt: new Date() },
        }).catch(() => { });
    }
    catch (err) {
        logger_1.default.warn(`[Worker] Falha ao enviar para ${phoneNumber}: ${err.message}`);
        await database_1.default.whatsAppInstance.update({
            where: { name: instanceName },
            data: { totalMessagesFailed: { increment: 1 } },
        }).catch(() => { });
    }
    // Atualizar contador da campanha
    await database_1.default.campaign.update({
        where: { id: campaignId },
        data: success
            ? { messagesSent: { increment: 1 } }
            : { messagesFailed: { increment: 1 } },
    });
    // Delay anti-ban entre mensagens
    if (contactIndex < totalContacts - 1) {
        await antiban_service_1.default.applyDelay(instanceName, contactIndex, intervalMs);
    }
    return { success, phoneNumber };
}
// Inicia o worker apenas se Redis disponível
async function startWorker() {
    const { connectRedis } = await Promise.resolve().then(() => __importStar(require('../config/redis')));
    await connectRedis();
    const redis = (0, redis_1.getRedis)();
    if (!redis) {
        logger_1.default.warn('[Worker] Redis não disponível — worker não iniciado');
        return;
    }
    const worker = new bullmq_1.Worker(queue_1.QUEUES.SEND_MESSAGES, processJob, {
        connection: redis,
        concurrency: 2, // 2 jobs simultâneos por worker
    });
    worker.on('completed', (job) => {
        logger_1.default.debug(`[Worker] Job ${job.id} completo`);
    });
    worker.on('failed', (job, err) => {
        logger_1.default.error(`[Worker] Job ${job?.id} falhou: ${err.message}`);
    });
    logger_1.default.info('[Worker] send.worker iniciado');
    process.on('SIGTERM', async () => {
        await worker.close();
        process.exit(0);
    });
}
startWorker().catch(logger_1.default.error);
//# sourceMappingURL=send.worker.js.map