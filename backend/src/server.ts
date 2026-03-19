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

        // Registra webhook usando nome real
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

  // 6. HTTP Server
  server.listen(PORT, HOST, () => {
    logger.info(`🚀 Servidor rodando em http://${HOST}:${PORT}`);
    logger.info(`📡 WebSocket: ws://${HOST}:${PORT}`);
    logger.info(`🌐 Frontend: ${process.env.FRONTEND_URL}`);
    logger.info(`🗄️  Evolution: ${process.env.EVOLUTION_API_URL}`);
  });
}

process.on('unhandledRejection', (err: any) => logger.error('[Unhandled]', err));
process.on('uncaughtException', (err: any) => { logger.error('[Uncaught]', err); process.exit(1); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

start();