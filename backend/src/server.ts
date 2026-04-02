/**
 * GlobalDisparos — Backend Enterprise v2.0
 * Express + Prisma + Socket.IO + BullMQ
 */

import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cron from 'node-cron';
import bcrypt from 'bcryptjs';

import logger from './utils/logger';
import { connectDB } from './config/database';
import { connectRedis } from './config/redis';
import { setupSocketServer } from './sockets/socket.server';
import { globalLimiter } from './middlewares/rateLimiter';
import prisma from './config/database';

// ─── ROTAS ───────────────────────────────────────────────────────────────────
import authRoutes     from './modules/auth/auth.routes';
import instanceRoutes from './modules/instance/instance.routes';
import groupRoutes    from './modules/group/group.routes';
import campaignRoutes from './modules/campaign/campaign.routes';
import webhookRoutes  from './modules/webhook/webhook.routes';
import listRoutes     from './modules/list/list.routes';
import statsRoutes    from './modules/stats/stats.routes';
import warmupRoutes   from './modules/warmup/warmup.routes';

const app = express();
const server = http.createServer(app);

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
setupSocketServer(server);

// ─── MIDDLEWARES ──────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
// Cloudflare e Nginx enviam X-Forwarded-For — necessário para rate limiting correto
app.set('trust proxy', 1);

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:3000',
];
// Aceita também www. prefixado
if (process.env.FRONTEND_URL) {
  const u = process.env.FRONTEND_URL;
  if (!u.includes('www.')) allowedOrigins.push(u.replace('https://', 'https://www.'));
}
app.use(cors({
  origin: (origin, cb) => {
    // Permite requests sem origin (mobile, Postman, webhooks)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, true); // Em produção, pode restringir aqui se necessário
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(compression());
app.use(globalLimiter);
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() }));
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// ─── ROTAS DA API ─────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/instances',  instanceRoutes);
app.use('/api/groups',     groupRoutes);
app.use('/api/disparador', campaignRoutes);  // /api/disparador/iniciar, send-single, etc.
app.use('/api/campaigns',  campaignRoutes);  // /api/campaigns (CampaignDispatcher, CampaignDashboard)
app.use('/api/webhook',    webhookRoutes);
app.use('/api/contacts',   listRoutes);
app.use('/api/stats',      statsRoutes);
app.use('/api/warmup',     warmupRoutes);

// 404
app.use((req, res) => {
  logger.warn(`[404] ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Rota não encontrada', path: req.path });
});

// ─── STARTUP ──────────────────────────────────────────────────────────────────
async function start() {
  const PORT = parseInt(process.env.PORT || '3001');
  const HOST = process.env.HOST || '0.0.0.0';

  // 1. Database
  try {
    await connectDB();
  } catch (err: any) {
    logger.error(`[DB] Erro de conexão: ${err.message}`);
    process.exit(1);
  }

  // 2. Redis (opcional)
  await connectRedis().catch(() => {});

  // 3. Seed admin
  try {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@gmail.com' } });
    if (!admin) {
      const hash = await bcrypt.hash('vip2026', 10);
      await prisma.user.create({
        data: { email: 'admin@gmail.com', password: hash, fullName: 'Administrador', role: 'admin', plan: 'enterprise', isActive: true },
      });
      logger.info('[Seed] Admin criado: admin@gmail.com / vip2026');
    }
  } catch (err: any) {
    logger.warn(`[Seed] ${err.message}`);
  }

  // 4. Sincronizar Evolution com banco e registrar webhooks
  (async () => {
    try {
      await new Promise(r => setTimeout(r, 3000)); // aguarda server estabilizar

      const wha = (await import('./services/whatsapp.service')).default;
      const all = await wha.fetchInstances().catch(() => []);
      if (!all.length) { logger.warn('[Startup] Evolution sem instâncias ou offline'); return; }

      logger.info(`[Startup] ${all.length} instâncias encontradas na Evolution`);

      // Limpa instâncias fantasma (existem no banco mas não na Evolution)
      const evNames = new Set(all.map((i: any) => i.instanceName).filter(Boolean));
      const dbInstances0 = await prisma.whatsAppInstance.findMany({ select: { id: true, name: true } });
      for (const db of dbInstances0) {
        if (db.name && !evNames.has(db.name)) {
          await prisma.whatsAppInstance.update({
            where: { id: db.id },
            data: { status: 'disconnected', qrCode: null }
          });
          logger.warn(`[Startup] Instância fantasma marcada como desconectada: ${db.name}`);
        }
      }

      const evolutionMap = new Map<string, any>();
      for (const inst of all) {
        if (inst.instanceName) evolutionMap.set(inst.instanceName, inst);
      }

      // Instâncias ativas no banco
      const dbInstances = await prisma.whatsAppInstance.findMany({ where: { isActive: true } });

      for (const dbInst of dbInstances) {
        // Usar nome real da instância (ex: "vvenda"), não "instance_1"
        let evName = dbInst.name || `instance_${dbInst.id}`;
        let evInst = evolutionMap.get(evName);

        // Se não encontrou e o nome é padrão "instance_N", tentar achar pelo phoneNumber
        if (!evInst && dbInst.phoneNumber && /^instance_\d+$/.test(evName)) {
          const phoneClean = dbInst.phoneNumber.replace(/\D/g, '');
          for (const [evN, evI] of evolutionMap) {
            const owner = (evI.ownerJid || evI.owner || '').replace('@s.whatsapp.net','').replace('@c.us','');
            if (owner === phoneClean) {
              evName = evN;
              evInst = evI;
              // Atualizar nome no banco
              await prisma.whatsAppInstance.update({ where: { id: dbInst.id }, data: { name: evN } });
              logger.info(`[Startup] Auto-corrigido nome da instância ${dbInst.id}: "${dbInst.name}" → "${evN}"`);
              break;
            }
          }
        }

        if (!evInst) {
          // Instância no banco mas não na Evolution — marca desconectada
          if (dbInst.status === 'connected') {
            await prisma.whatsAppInstance.update({ where: { id: dbInst.id }, data: { status: 'disconnected', qrCode: null } });
            logger.warn(`[Startup] ${evName} não encontrada na Evolution — desconectada`);
          }
          continue;
        }

        // Pular instâncias com nomes inválidos
        if (!evName || evName === '.' || evName.includes('/')) {
          logger.warn(`[Startup] Nome inválido ignorado: ${evName}`);
          continue;
        }
        // Registra webhook com delay para não sobrecarregar Evolution
        await new Promise(r => setTimeout(r, 500)); // 500ms entre cada registro
        await wha.registerWebhook(evName).catch(() => {});
        logger.info(`[Startup] Webhook registrado: ${evName} (id=${dbInst.id})`);

        const isOpen = evInst.status === 'open';
        if (isOpen) {
          const owner = evInst.ownerJid || evInst.owner;
          const phoneNumber = owner ? owner.replace('@s.whatsapp.net', '').replace('@c.us', '') : dbInst.phoneNumber;
          await prisma.whatsAppInstance.update({
            where: { id: dbInst.id },
            data: { status: 'connected', qrCode: null, connectedAt: dbInst.connectedAt || new Date(), ...(phoneNumber ? { phoneNumber } : {}) },
          });
          logger.info(`✅ [Startup] ${evName} conectada${phoneNumber ? ` (${phoneNumber})` : ''}`);

          // Emite para o frontend
          const { emitToUser } = await import('./sockets/socket.server');
          emitToUser(dbInst.userId, 'whatsapp_connected', { instanceId: dbInst.id, phoneNumber, status: 'connected' });
        } else if (!isOpen && dbInst.status === 'connected') {
          await prisma.whatsAppInstance.update({ where: { id: dbInst.id }, data: { status: 'disconnected', qrCode: null } });
          logger.warn(`[Startup] ${evName} desconectada`);
        }
      }
    } catch (err: any) {
      logger.warn(`[Startup] Webhook startup falhou: ${err.message}`);
    }
  })();

  // 5. Cron jobs
  // Reset diário de contadores anti-ban
  cron.schedule('0 0 * * *', async () => {
    try {
      await prisma.whatsAppInstance.updateMany({ data: { dailyMessagesSent: 0 } });
      logger.info('[Cron] Contadores diários resetados');
    } catch { /* ignora */ }
  });

  // A cada 5min: resetar instâncias presas em 'connecting' + matar warmup zumbi
  cron.schedule('*/5 * * * *', async () => {
    try {
      // 1. Resetar instâncias presas em connecting por mais de 10min
      const cutoff = new Date(Date.now() - 10 * 60 * 1000);
      const stuck = await prisma.whatsAppInstance.updateMany({
        where: { status: 'connecting', isActive: true, updatedAt: { lt: cutoff } },
        data: { status: 'disconnected', qrCode: null },
      });
      if (stuck.count > 0) logger.warn(`[Cron] ${stuck.count} instância(s) presa(s) em connecting → disconnected`);

      // 2. Matar warmups de instâncias inativas no banco
      await prisma.$executeRaw`
        UPDATE warmup_states SET running = false
        WHERE instance_id IN (
          SELECT id FROM whatsapp_instances WHERE is_active = false
        )
      `.catch(() => {});

      // 3. Sincronizar status: busca instâncias que o banco diz connected mas Evolution diz close
      const dbConnected = await prisma.whatsAppInstance.findMany({
        where: { status: 'connected', isActive: true },
        select: { id: true, name: true, userId: true, phoneNumber: true }
      });
      if (dbConnected.length > 0) {
        const wha = (await import('./services/whatsapp.service')).default;
        const { emitToUser } = await import('./sockets/socket.server');
        for (const inst of dbConnected) {
          try {
            const state = await wha.getInstanceState(inst.name);
            if (state === 'close') {
              await prisma.whatsAppInstance.update({
                where: { id: inst.id },
                data: { status: 'disconnected', qrCode: null }
              });
              emitToUser(inst.userId, 'whatsapp_disconnected', { instanceId: inst.id });
              logger.warn(`[Cron] ${inst.name} desconectada detectada no sync`);
            }
          } catch { /* ignora timeout */ }
          await new Promise(r => setTimeout(r, 300)); // 300ms entre cada check
        }
      }
    } catch { /* ignora */ }
  });

  // A cada 2 minutos: sincronizar status do banco com a Evolution
  cron.schedule('*/2 * * * *', async () => {
    try {
      const wha = (await import('./services/whatsapp.service')).default;
      const evInstances = await wha.fetchInstances().catch(() => []);
      if (!evInstances.length) return;

      const { emitToUser } = await import('./sockets/socket.server');

      for (const evInst of evInstances) {
        const name = evInst.instanceName;
        const evStatus = evInst.status; // 'connected' | 'disconnected' | 'connecting'
        if (!name) continue;

        const dbInst = await prisma.whatsAppInstance.findFirst({
          where: { name, isActive: true }
        });
        if (!dbInst) continue;

        if (evStatus === 'connected' && dbInst.status !== 'connected') {
          const owner = evInst.ownerJid || evInst.owner || '';
          const phone = owner.replace('@s.whatsapp.net','').replace('@c.us','') || dbInst.phoneNumber;
          await prisma.whatsAppInstance.update({
            where: { id: dbInst.id },
            data: { status: 'connected', qrCode: null, connectedAt: dbInst.connectedAt || new Date(), ...(phone ? { phoneNumber: phone } : {}) }
          });
          emitToUser(dbInst.userId, 'whatsapp_connected', { instanceId: dbInst.id, phoneNumber: phone, status: 'connected' });
          logger.info(`[Sync] ${name} -> connected (${phone})`);
        } else if (evStatus === 'disconnected' && dbInst.status === 'connected') {
          await prisma.whatsAppInstance.update({
            where: { id: dbInst.id },
            data: { status: 'disconnected', qrCode: null }
          });
          emitToUser(dbInst.userId, 'whatsapp_disconnected', { instanceId: dbInst.id });
          logger.warn(`[Sync] ${name} -> disconnected`);
        }
      }
    } catch { /* ignora */ }
  });

  // A cada hora: cancelar campanhas de instâncias deletadas
  cron.schedule('0 * * * *', async () => {
    try {
      const cancelled = await prisma.campaign.updateMany({
        where: { status: { in: ['running', 'paused', 'pending'] }, instance: { isActive: false } },
        data: { status: 'cancelled', completedAt: new Date() },
      });
      if (cancelled.count > 0) logger.warn(`[Cron] ${cancelled.count} campanha(s) zumbi cancelada(s)`);
    } catch { /* ignora */ }
  });

  // 6. HTTP Server
  server.listen(PORT, HOST, () => {
    logger.info(`🚀 Servidor rodando em http://${HOST}:${PORT}`);
    logger.info(`📡 WebSocket: ws://${HOST}:${PORT}`);
    logger.info(`🌐 Frontend: ${process.env.FRONTEND_URL}`);
    logger.info(`🗄️  Evolution: ${process.env.EVOLUTION_API_URL}`);
  });
}

process.on('unhandledRejection', (err: any) => logger.error('[Unhandled]', err));
process.on('uncaughtException', (err: any) => { logger.error('[Uncaught]', err); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

start();