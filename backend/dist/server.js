"use strict";
/**
 * GlobalDisparos — Backend Enterprise v2.0
 * Express + Prisma + Socket.IO + BullMQ
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
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const node_cron_1 = __importDefault(require("node-cron"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const logger_1 = __importDefault(require("./utils/logger"));
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const socket_server_1 = require("./sockets/socket.server");
const rateLimiter_1 = require("./middlewares/rateLimiter");
const database_2 = __importDefault(require("./config/database"));
// ─── ROTAS ───────────────────────────────────────────────────────────────────
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const instance_routes_1 = __importDefault(require("./modules/instance/instance.routes"));
const group_routes_1 = __importDefault(require("./modules/group/group.routes"));
const campaign_routes_1 = __importDefault(require("./modules/campaign/campaign.routes"));
const webhook_routes_1 = __importDefault(require("./modules/webhook/webhook.routes"));
const list_routes_1 = __importDefault(require("./modules/list/list.routes"));
const stats_routes_1 = __importDefault(require("./modules/stats/stats.routes"));
const warmup_routes_1 = __importDefault(require("./modules/warmup/warmup.routes"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
(0, socket_server_1.setupSocketServer)(server);
// ─── MIDDLEWARES ──────────────────────────────────────────────────────────────
app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
// Cloudflare e Nginx enviam X-Forwarded-For — necessário para rate limiting correto
app.set('trust proxy', 1);
app.use((0, cors_1.default)({
    origin: true, // Permite qualquer origem — segurança feita via JWT em cada rota
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use((0, compression_1.default)());
app.use(rateLimiter_1.globalLimiter);
app.use(express_1.default.json({ limit: '20mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '20mb' }));
// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() }));
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
// ─── ROTAS DA API ─────────────────────────────────────────────────────────────
app.use('/api/auth', auth_routes_1.default);
app.use('/api/instances', instance_routes_1.default);
app.use('/api/groups', group_routes_1.default);
app.use('/api/disparador', campaign_routes_1.default); // /api/disparador/iniciar, send-single, etc.
app.use('/api/campaigns', campaign_routes_1.default); // /api/campaigns (CampaignDispatcher, CampaignDashboard)
app.use('/api/webhook', webhook_routes_1.default);
app.use('/api/contacts', list_routes_1.default);
app.use('/api/stats', stats_routes_1.default);
app.use('/api/warmup', warmup_routes_1.default);
// 404
app.use((req, res) => {
    logger_1.default.warn(`[404] ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Rota não encontrada', path: req.path });
});
// ─── STARTUP ──────────────────────────────────────────────────────────────────
async function start() {
    const PORT = parseInt(process.env.PORT || '3001');
    const HOST = process.env.HOST || '0.0.0.0';
    // 1. Database
    try {
        await (0, database_1.connectDB)();
    }
    catch (err) {
        logger_1.default.error(`[DB] Erro de conexão: ${err.message}`);
        process.exit(1);
    }
    // 2. Redis (opcional)
    await (0, redis_1.connectRedis)().catch(() => { });
    // 3. Seed admin
    try {
        const admin = await database_2.default.user.findUnique({ where: { email: 'admin@gmail.com' } });
        if (!admin) {
            const hash = await bcryptjs_1.default.hash('vip2026', 10);
            await database_2.default.user.create({
                data: { email: 'admin@gmail.com', password: hash, fullName: 'Administrador', role: 'admin', plan: 'enterprise', isActive: true },
            });
            logger_1.default.info('[Seed] Admin criado com sucesso');
        }
    }
    catch (err) {
        logger_1.default.warn(`[Seed] ${err.message}`);
    }
    // 4. Sincronizar Evolution com banco e registrar webhooks
    (async () => {
        try {
            await new Promise(r => setTimeout(r, 3000)); // aguarda server estabilizar
            const wha = (await Promise.resolve().then(() => __importStar(require('./services/whatsapp.service')))).default;
            const all = await wha.fetchInstances().catch(() => []);
            if (!all.length) {
                logger_1.default.warn('[Startup] Evolution sem instâncias ou offline');
                return;
            }
            logger_1.default.info(`[Startup] ${all.length} instâncias encontradas na Evolution`);
            // Limpa instâncias fantasma (existem no banco mas não na Evolution)
            const evNames = new Set(all.map((i) => i.instanceName).filter(Boolean));
            const dbInstances0 = await database_2.default.whatsAppInstance.findMany({ select: { id: true, name: true } });
            for (const db of dbInstances0) {
                if (db.name && !evNames.has(db.name)) {
                    await database_2.default.whatsAppInstance.update({
                        where: { id: db.id },
                        data: { status: 'disconnected', qrCode: null }
                    });
                    logger_1.default.warn(`[Startup] Instância fantasma marcada como desconectada: ${db.name}`);
                }
            }
            const evolutionMap = new Map();
            for (const inst of all) {
                if (inst.instanceName)
                    evolutionMap.set(inst.instanceName, inst);
            }
            // Instâncias ativas no banco
            const dbInstances = await database_2.default.whatsAppInstance.findMany({ where: { isActive: true } });
            for (const dbInst of dbInstances) {
                // Usar nome real da instância (ex: "vvenda"), não "instance_1"
                let evName = dbInst.name || `instance_${dbInst.id}`;
                let evInst = evolutionMap.get(evName);
                // Se não encontrou e o nome é padrão "instance_N", tentar achar pelo phoneNumber
                if (!evInst && dbInst.phoneNumber && /^instance_\d+$/.test(evName)) {
                    const phoneClean = dbInst.phoneNumber.replace(/\D/g, '');
                    for (const [evN, evI] of evolutionMap) {
                        const owner = (evI.ownerJid || evI.owner || '').replace('@s.whatsapp.net', '').replace('@c.us', '');
                        if (owner === phoneClean) {
                            evName = evN;
                            evInst = evI;
                            // Atualizar nome no banco
                            await database_2.default.whatsAppInstance.update({ where: { id: dbInst.id }, data: { name: evN } });
                            logger_1.default.info(`[Startup] Auto-corrigido nome da instância ${dbInst.id}: "${dbInst.name}" → "${evN}"`);
                            break;
                        }
                    }
                }
                if (!evInst) {
                    // Instância no banco mas não na Evolution — marca desconectada
                    if (dbInst.status === 'connected') {
                        await database_2.default.whatsAppInstance.update({ where: { id: dbInst.id }, data: { status: 'disconnected', qrCode: null } });
                        logger_1.default.warn(`[Startup] ${evName} não encontrada na Evolution — desconectada`);
                    }
                    continue;
                }
                // Pular instâncias com nomes inválidos
                if (!evName || evName === '.' || evName.includes('/')) {
                    logger_1.default.warn(`[Startup] Nome inválido ignorado: ${evName}`);
                    continue;
                }
                // Registra webhook com delay para não sobrecarregar Evolution
                await new Promise(r => setTimeout(r, 500)); // 500ms entre cada registro
                await wha.registerWebhook(evName).catch(() => { });
                logger_1.default.info(`[Startup] Webhook registrado: ${evName} (id=${dbInst.id})`);
                const isOpen = evInst.status === 'open';
                if (isOpen) {
                    const owner = evInst.ownerJid || evInst.owner;
                    const phoneNumber = owner ? owner.replace('@s.whatsapp.net', '').replace('@c.us', '') : dbInst.phoneNumber;
                    await database_2.default.whatsAppInstance.update({
                        where: { id: dbInst.id },
                        data: { status: 'connected', qrCode: null, connectedAt: dbInst.connectedAt || new Date(), ...(phoneNumber ? { phoneNumber } : {}) },
                    });
                    logger_1.default.info(`✅ [Startup] ${evName} conectada${phoneNumber ? ` (${phoneNumber})` : ''}`);
                    // Emite para o frontend
                    const { emitToUser } = await Promise.resolve().then(() => __importStar(require('./sockets/socket.server')));
                    emitToUser(dbInst.userId, 'whatsapp_connected', { instanceId: dbInst.id, phoneNumber, status: 'connected' });
                }
                else if (!isOpen && dbInst.status === 'connected') {
                    await database_2.default.whatsAppInstance.update({ where: { id: dbInst.id }, data: { status: 'disconnected', qrCode: null } });
                    logger_1.default.warn(`[Startup] ${evName} desconectada`);
                }
            }
        }
        catch (err) {
            logger_1.default.warn(`[Startup] Webhook startup falhou: ${err.message}`);
        }
    })();
    // 5. Cron jobs
    // Reset diário de contadores anti-ban
    node_cron_1.default.schedule('0 0 * * *', async () => {
        try {
            await database_2.default.whatsAppInstance.updateMany({ data: { dailyMessagesSent: 0 } });
            logger_1.default.info('[Cron] Contadores diários resetados');
        }
        catch { /* ignora */ }
    });
    // A cada 5min: resetar instâncias presas em 'connecting' + matar warmup zumbi
    node_cron_1.default.schedule('*/5 * * * *', async () => {
        try {
            // 1. Resetar instâncias presas em connecting por mais de 10min
            const cutoff = new Date(Date.now() - 10 * 60 * 1000);
            const stuck = await database_2.default.whatsAppInstance.updateMany({
                where: { status: 'connecting', isActive: true, updatedAt: { lt: cutoff } },
                data: { status: 'disconnected', qrCode: null },
            });
            if (stuck.count > 0)
                logger_1.default.warn(`[Cron] ${stuck.count} instância(s) presa(s) em connecting → disconnected`);
            // 2. Matar warmups de instâncias inativas no banco
            await database_2.default.$executeRaw `
        UPDATE warmup_states SET running = false
        WHERE instance_id IN (
          SELECT id FROM whatsapp_instances WHERE is_active = false
        )
      `.catch(() => { });
            // 3. Sincronizar status: busca instâncias que o banco diz connected mas Evolution diz close
            const dbConnected = await database_2.default.whatsAppInstance.findMany({
                where: { status: 'connected', isActive: true },
                select: { id: true, name: true, userId: true, phoneNumber: true }
            });
            if (dbConnected.length > 0) {
                const wha = (await Promise.resolve().then(() => __importStar(require('./services/whatsapp.service')))).default;
                const { emitToUser } = await Promise.resolve().then(() => __importStar(require('./sockets/socket.server')));
                for (const inst of dbConnected) {
                    try {
                        const state = await wha.getInstanceState(inst.name);
                        if (state === 'close') {
                            await database_2.default.whatsAppInstance.update({
                                where: { id: inst.id },
                                data: { status: 'disconnected', qrCode: null }
                            });
                            emitToUser(inst.userId, 'whatsapp_disconnected', { instanceId: inst.id });
                            logger_1.default.warn(`[Cron] ${inst.name} desconectada detectada no sync`);
                        }
                    }
                    catch { /* ignora timeout */ }
                    await new Promise(r => setTimeout(r, 300)); // 300ms entre cada check
                }
            }
        }
        catch { /* ignora */ }
    });
    // A cada 2 minutos: sincronizar status do banco com a Evolution
    node_cron_1.default.schedule('*/2 * * * *', async () => {
        try {
            const wha = (await Promise.resolve().then(() => __importStar(require('./services/whatsapp.service')))).default;
            const evInstances = await wha.fetchInstances().catch(() => []);
            if (!evInstances.length)
                return;
            const { emitToUser } = await Promise.resolve().then(() => __importStar(require('./sockets/socket.server')));
            for (const evInst of evInstances) {
                const name = evInst.instanceName;
                const evStatus = evInst.status; // 'connected' | 'disconnected' | 'connecting'
                if (!name)
                    continue;
                const dbInst = await database_2.default.whatsAppInstance.findFirst({
                    where: { name, isActive: true }
                });
                if (!dbInst)
                    continue;
                if (evStatus === 'connected' && dbInst.status !== 'connected') {
                    const owner = evInst.ownerJid || evInst.owner || '';
                    const phone = owner.replace('@s.whatsapp.net', '').replace('@c.us', '') || dbInst.phoneNumber;
                    await database_2.default.whatsAppInstance.update({
                        where: { id: dbInst.id },
                        data: { status: 'connected', qrCode: null, connectedAt: dbInst.connectedAt || new Date(), ...(phone ? { phoneNumber: phone } : {}) }
                    });
                    emitToUser(dbInst.userId, 'whatsapp_connected', { instanceId: dbInst.id, phoneNumber: phone, status: 'connected' });
                    logger_1.default.info(`[Sync] ${name} -> connected (${phone})`);
                }
                else if (evStatus === 'disconnected' && dbInst.status === 'connected') {
                    await database_2.default.whatsAppInstance.update({
                        where: { id: dbInst.id },
                        data: { status: 'disconnected', qrCode: null }
                    });
                    emitToUser(dbInst.userId, 'whatsapp_disconnected', { instanceId: dbInst.id });
                    logger_1.default.warn(`[Sync] ${name} -> disconnected`);
                }
            }
        }
        catch { /* ignora */ }
    });
    // A cada hora: cancelar campanhas de instâncias deletadas
    node_cron_1.default.schedule('0 * * * *', async () => {
        try {
            const cancelled = await database_2.default.campaign.updateMany({
                where: { status: { in: ['running', 'paused', 'pending'] }, instance: { isActive: false } },
                data: { status: 'cancelled', completedAt: new Date() },
            });
            if (cancelled.count > 0)
                logger_1.default.warn(`[Cron] ${cancelled.count} campanha(s) zumbi cancelada(s)`);
        }
        catch { /* ignora */ }
    });
    // 6. HTTP Server
    server.listen(PORT, HOST, () => {
        logger_1.default.info(`🚀 Servidor rodando em http://${HOST}:${PORT}`);
        logger_1.default.info(`📡 WebSocket: ws://${HOST}:${PORT}`);
        logger_1.default.info(`🌐 Frontend: ${process.env.FRONTEND_URL}`);
        logger_1.default.info(`🗄️  Evolution: ${process.env.EVOLUTION_API_URL}`);
    });
}
process.on('unhandledRejection', (err) => logger_1.default.error('[Unhandled]', err));
process.on('uncaughtException', (err) => { logger_1.default.error('[Uncaught]', err); });
process.on('SIGTERM', async () => { await database_2.default.$disconnect(); process.exit(0); });
start();
//# sourceMappingURL=server.js.map