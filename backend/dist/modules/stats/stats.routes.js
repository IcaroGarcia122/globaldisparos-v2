"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
const antiban_service_1 = __importDefault(require("../../services/antiban.service"));
const logger_1 = __importDefault(require("../../utils/logger"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
/** GET /api/stats/user — Métricas gerais do painel */
router.get('/user', async (req, res) => {
    try {
        const userId = req.user.id;
        const [instances, campaigns] = await Promise.all([
            database_1.default.whatsAppInstance.findMany({ where: { userId, isActive: true } }),
            database_1.default.campaign.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
        ]);
        // Somar das campanhas EXCLUINDO aquecimento (campanhas com nome "Aquecimento ·")
        const campaignStats = await database_1.default.campaign.aggregate({
            where: {
                userId,
                status: { in: ['completed', 'cancelled'] },
                NOT: { name: { startsWith: 'Aquecimento ·' } },
            },
            _sum: { messagesSent: true, messagesFailed: true },
        });
        // Fonte de mensagens: APENAS campanhas de disparo (excluindo warmup)
        // A instância pode ter warmup misturado — campanhas são a fonte limpa
        const sentFromCampaigns = campaignStats._sum.messagesSent || 0;
        const failedFromCampaigns = campaignStats._sum.messagesFailed || 0;
        // Fallback: instâncias (mas só se não houver campanhas registradas)
        const sentFromInstances = instances.reduce((s, i) => s + (i.totalMessagesSent || 0), 0);
        const failedFromInstances = instances.reduce((s, i) => s + (i.totalMessagesFailed || 0), 0);
        // Campanhas como fonte principal; instâncias como fallback se campanhas zeradas
        const totalSent = sentFromCampaigns > 0 ? sentFromCampaigns : sentFromInstances;
        const totalFailed = failedFromCampaigns > 0 ? failedFromCampaigns : failedFromInstances;
        const successRate = totalSent > 0
            ? parseFloat(((totalSent / (totalSent + totalFailed)) * 100).toFixed(1))
            : 0;
        // Logs recentes das campanhas
        const recentLogs = campaigns.map(c => ({
            id: c.id,
            name: c.name,
            status: c.status,
            sent: c.messagesSent || 0,
            failed: c.messagesFailed || 0,
            total: c.totalContacts || 0,
            successRate: c.totalContacts > 0
                ? Math.round(((c.messagesSent || 0) / c.totalContacts) * 100) + '%'
                : '0%',
            createdAt: c.createdAt,
            completedAt: c.completedAt,
        }));
        return res.json({
            // Instâncias
            totalInstances: instances.length,
            connectedInstances: instances.filter(i => i.status === 'connected').length,
            disconnectedInstances: instances.filter(i => i.status === 'disconnected').length,
            bannedInstances: instances.filter(i => i.status === 'banned').length,
            // Campanhas
            totalCampaigns: campaigns.length,
            runningCampaigns: campaigns.filter(c => c.status === 'running').length,
            completedCampaigns: campaigns.filter(c => c.status === 'completed').length,
            // Mensagens
            totalMessagesSent: totalSent,
            totalMessagesFailed: totalFailed,
            messagesSent: totalSent, // alias para compatibilidade
            successRate: successRate + '%',
            successRateNum: successRate,
            dailyAverage: Math.round(totalSent / Math.max(campaigns.length, 1)),
            // Logs recentes
            recentLogs,
            // Erros técnicos
            technicalErrors: totalFailed,
        });
    }
    catch (err) {
        logger_1.default.error('Erro ao buscar stats:', err);
        return res.status(500).json({ error: err.message });
    }
});
/** GET /api/stats/logs — Logs de atividade completos */
router.get('/logs', async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const campaigns = await database_1.default.campaign.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                instance: { select: { name: true, phoneNumber: true } },
            },
        });
        const total = await database_1.default.campaign.count({ where: { userId } });
        return res.json({
            logs: campaigns.map(c => ({
                id: c.id,
                type: 'campaign',
                instanceName: c.instance?.name || `Instância ${c.instanceId}`,
                instancePhone: c.instance?.phoneNumber || '',
                name: c.name,
                status: c.status,
                sent: c.messagesSent || 0,
                failed: c.messagesFailed || 0,
                total: c.totalContacts || 0,
                successRate: c.totalContacts > 0
                    ? Math.round(((c.messagesSent || 0) / c.totalContacts) * 100) + '%'
                    : '0%',
                message: (c.message || '').substring(0, 80) + ((c.message || '').length > 80 ? '...' : ''),
                startedAt: c.startedAt,
                completedAt: c.completedAt,
                createdAt: c.createdAt,
                duration: c.startedAt && c.completedAt
                    ? Math.round((new Date(c.completedAt).getTime() - new Date(c.startedAt).getTime()) / 1000) + 's'
                    : null,
            })),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/** GET /api/stats/instance/:id */
router.get('/instance/:id', async (req, res) => {
    const instance = await database_1.default.whatsAppInstance.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!instance || instance.userId !== req.user.id)
        return res.status(403).json({ error: 'Acesso negado' });
    const antiBan = antiban_service_1.default.getStatus(`instance_${instance.id}`);
    return res.json({ ...instance, antiBanInfo: antiBan });
});
/** GET /api/stats/antiban/status */
router.get('/antiban/status', async (req, res) => {
    const instances = await database_1.default.whatsAppInstance.findMany({ where: { userId: req.user.id, isActive: true } });
    return res.json({
        totalInstances: instances.length,
        healthyInstances: instances.filter(i => i.status === 'connected').length,
        bannedInstances: instances.filter(i => i.status === 'banned').length,
        instances: instances.map(i => ({
            id: i.id, name: i.name, status: i.status,
            totalSent: i.totalMessagesSent, totalFailed: i.totalMessagesFailed,
        })),
    });
});
exports.default = router;
//# sourceMappingURL=stats.routes.js.map