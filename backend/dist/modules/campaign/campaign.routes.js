"use strict";
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
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const xlsx_1 = __importDefault(require("xlsx"));
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
const whatsapp_service_1 = __importDefault(require("../../services/whatsapp.service"));
const groups_service_1 = require("../../services/groups.service");
const socket_server_1 = require("../../sockets/socket.server");
const delay_1 = require("../../utils/delay");
const logger_1 = __importDefault(require("../../utils/logger"));
/** Retorna o nome real da instância na Evolution (ex: "vvenda", não "instance_1") */
async function getEvolutionName(instanceId) {
    const id = parseInt(String(instanceId));
    if (isNaN(id))
        return String(instanceId);
    const inst = await database_1.default.whatsAppInstance.findUnique({
        where: { id }, select: { name: true, phoneNumber: true }
    }).catch(() => null);
    if (!inst)
        return `instance_${id}`;
    const name = inst.name || `instance_${id}`;
    // Se o nome segue o padrão antigo "instance_N", verificar se a Evolution
    // conhece esse nome — se não, tentar buscar pelo phoneNumber
    if (/^instance_\d+$/.test(name) && inst.phoneNumber) {
        try {
            const { default: ws } = await Promise.resolve().then(() => __importStar(require('../../services/whatsapp.service')));
            const all = await ws.fetchInstances().catch(() => []);
            const match = all.find((i) => {
                const owner = (i.ownerJid || i.owner || '').replace('@s.whatsapp.net', '').replace('@c.us', '');
                return owner === inst.phoneNumber?.replace(/\D/g, '');
            });
            if (match?.instanceName && match.instanceName !== name) {
                // Atualizar nome no banco para futuras chamadas
                await database_1.default.whatsAppInstance.update({ where: { id }, data: { name: match.instanceName } }).catch(() => { });
                logger_1.default.info(`[Campaign] Corrigindo nome da instância ${id}: "${name}" → "${match.instanceName}"`);
                return match.instanceName;
            }
        }
        catch { /* silencioso */ }
    }
    return name;
}
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
// ─── Controle de campanhas em execução ────────────────────────────────────────
// Map local para controle de pause/cancel em tempo real (dentro do processo)
// O status canônico fica no banco — sobrevive a restarts
const cancelledCampaigns = new Set();
const runningCampaigns = new Map();
// Ao iniciar o servidor, marcar como 'cancelled' campanhas que ficaram presas em 'running'
// (isso acontece quando o processo é reiniciado com campanha em andamento)
async function resetStaleCampaigns() {
    try {
        const stale = await database_1.default.campaign.updateMany({
            where: { status: { in: ['running', 'paused'] } },
            data: { status: 'cancelled', completedAt: new Date() },
        });
        if (stale.count > 0) {
            logger_1.default.info(`[Campaign] ${stale.count} campanha(s) interrompida(s) pelo restart foram marcadas como canceladas`);
        }
    }
    catch (err) {
        logger_1.default.warn(`[Campaign] Erro ao limpar campanhas travadas: ${err.message}`);
    }
}
setTimeout(resetStaleCampaigns, 2000);
// ─── ANTI-BAN: randomiza o texto da mensagem levemente ───────────────────────
function randomizeMessage(template, contact) {
    let msg = template
        .replace(/{nome}/gi, contact.name || 'Amigo')
        .replace(/{numero}/gi, contact.number);
    // Adiciona variação invisível anti-ban (zero-width chars)
    const zwChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
    const zwChar = zwChars[Math.floor(Math.random() * zwChars.length)];
    return msg + zwChar;
}
// ─── EXECUÇÃO DE CAMPANHA EM BACKGROUND ──────────────────────────────────────
async function runCampaign(campaignId, instanceName, contacts, message, options, userId) {
    const startTime = Date.now();
    let sent = 0, failed = 0;
    runningCampaigns.set(campaignId, { cancel: false, pause: false });
    // Filtra admins se necessário
    let targets = contacts;
    if (options.excludeAdmins && options.adminNumbers?.length) {
        const adminSet = new Set(options.adminNumbers);
        targets = contacts.filter(c => !adminSet.has(c.number));
        logger_1.default.info(`[Campaign] Excluídos ${contacts.length - targets.length} admins`);
    }
    if (targets.length === 0) {
        await database_1.default.campaign.update({
            where: { id: campaignId },
            data: { status: 'cancelled', completedAt: new Date() },
        });
        (0, socket_server_1.emitToUser)(userId, 'campanha:erro', { campaignId, error: 'Nenhum contato após exclusão de admins' });
        runningCampaigns.delete(campaignId);
        return;
    }
    await database_1.default.campaign.update({
        where: { id: campaignId },
        data: { totalContacts: targets.length, messagesScheduled: targets.length },
    });
    try {
        for (let i = 0; i < targets.length; i++) {
            const ctrl = runningCampaigns.get(campaignId);
            if (ctrl?.cancel)
                break;
            // Checar status no banco (fonte de verdade — funciona mesmo após restart parcial)
            const camp = await database_1.default.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
            if (!camp || camp.status === 'cancelled')
                break;
            // Aguarda se pausada (checa Map E banco)
            while (runningCampaigns.get(campaignId)?.pause || camp?.status === 'paused') {
                await new Promise(r => setTimeout(r, 2000));
                const recheck = await database_1.default.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
                if (!recheck || recheck.status === 'cancelled') {
                    runningCampaigns.get(campaignId) && (runningCampaigns.get(campaignId).cancel = true);
                    break;
                }
                if (recheck.status === 'running') {
                    if (runningCampaigns.get(campaignId))
                        runningCampaigns.get(campaignId).pause = false;
                    break;
                }
            }
            if (runningCampaigns.get(campaignId)?.cancel)
                break;
            const contact = targets[i];
            // Personaliza mensagem
            const finalMsg = options.randomizeMessage
                ? randomizeMessage(message, contact)
                : message.replace(/{nome}/gi, contact.name || 'Amigo').replace(/{numero}/gi, contact.number);
            try {
                await whatsapp_service_1.default.sendText(instanceName, contact.number, finalMsg);
                sent++;
                await database_1.default.whatsAppInstance.update({
                    where: { name: instanceName },
                    data: { totalMessagesSent: { increment: 1 }, dailyMessagesSent: { increment: 1 }, lastMessageAt: new Date() },
                }).catch(() => { });
            }
            catch (err) {
                failed++;
                logger_1.default.warn(`[Campaign] Falha ${contact.number}: ${err.message}`);
                await database_1.default.whatsAppInstance.update({
                    where: { name: instanceName },
                    data: { totalMessagesFailed: { increment: 1 } },
                }).catch(() => { });
            }
            if ((sent + failed) % 10 === 0 || i === targets.length - 1) {
                await database_1.default.campaign.update({ where: { id: campaignId }, data: { messagesSent: sent, messagesFailed: failed } });
            }
            // Emite progresso
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = sent / (elapsed || 1);
            const remaining = targets.length - i - 1;
            const eta = speed > 0 ? remaining / speed : 0;
            const progress = {
                campaignId, sent, failed, remaining,
                percentual: ((i + 1) / targets.length * 100).toFixed(1),
                elapsedSeconds: Math.round(elapsed),
                remainingSeconds: Math.round(eta),
                estimatedTotal: Math.round(targets.length / (speed || 1)),
                velocidade: speed.toFixed(2) + ' msgs/seg',
                currentContact: contact.number,
            };
            (0, socket_server_1.emitToUser)(userId, 'campanha:progresso', progress);
            (0, socket_server_1.emitToCampaign)(campaignId, 'campanha:progresso', progress);
            // Delay anti-ban
            if (i < targets.length - 1) {
                const minMs = options.intervalMs;
                const maxMs = options.randomizeInterval ? options.intervalMs * 1.5 : options.intervalMs;
                await (0, delay_1.randomDelay)(minMs, Math.round(maxMs));
            }
        }
        const ctrl = runningCampaigns.get(campaignId);
        const finalStatus = ctrl?.cancel ? 'cancelled' : 'completed';
        await database_1.default.campaign.update({
            where: { id: campaignId },
            data: { status: finalStatus, completedAt: new Date(), messagesSent: sent, messagesFailed: failed },
        });
        const result = {
            campaignId, totalSent: sent, totalFailed: failed,
            successRate: targets.length > 0 ? ((sent / targets.length) * 100).toFixed(1) + '%' : '0%',
            duration: ((Date.now() - startTime) / 1000).toFixed(0) + 's',
        };
        (0, socket_server_1.emitToUser)(userId, 'campanha:concluida', result);
        (0, socket_server_1.emitToCampaign)(campaignId, 'campanha:concluida', result);
        logger_1.default.info(`[Campaign] ✅ ${campaignId} finalizada: ${sent} enviadas, ${failed} erros`);
    }
    catch (err) {
        logger_1.default.error(`[Campaign] Erro: ${err.message}`);
        await database_1.default.campaign.update({ where: { id: campaignId }, data: { status: 'cancelled', completedAt: new Date() } });
        (0, socket_server_1.emitToUser)(userId, 'campanha:erro', { campaignId, error: err.message });
    }
    finally {
        runningCampaigns.delete(campaignId);
    }
}
// ─── POST /api/disparador/iniciar ─────────────────────────────────────────────
router.post('/iniciar', async (req, res) => {
    try {
        const { instanceId, groupIds, message, messages, interval = 3000, campaignName, randomizeInterval = false, randomizeMessage: doRandomize = true, excludeAdmins = false, skipAlreadySent = false, randomizeOrder = false, } = req.body;
        // Suporta múltiplas mensagens (variações anti-spam)
        const messageVariations = (messages?.length > 0 ? messages : [message]).filter(Boolean);
        const userId = req.user.id;
        if (!instanceId)
            return res.status(400).json({ error: 'instanceId é obrigatório' });
        if (!message?.trim())
            return res.status(400).json({ error: 'Mensagem é obrigatória' });
        const { xlsxNumbers = [] } = req.body;
        const hasGroups = groupIds?.length > 0;
        const hasXlsx = xlsxNumbers.length > 0;
        if (!hasGroups && !hasXlsx)
            return res.status(400).json({ error: 'Selecione um grupo ou carregue uma lista de números' });
        const instance = await database_1.default.whatsAppInstance.findUnique({ where: { id: parseInt(String(instanceId)) } });
        if (!instance)
            return res.status(404).json({ error: 'Instância não encontrada' });
        if (instance.status !== 'connected')
            return res.status(409).json({ error: 'Instância não está conectada' });
        // Coleta contatos — de grupos OU de lista xlsx
        const allContacts = new Map();
        const allAdmins = new Set();
        if (hasGroups) {
            for (const groupId of groupIds) {
                try {
                    const { participants, admins } = await (0, groups_service_1.getParticipants)(parseInt(String(instanceId)), groupId);
                    for (const phone of participants) {
                        if (!allContacts.has(phone))
                            allContacts.set(phone, { number: phone });
                    }
                    admins.forEach((a) => allAdmins.add(a));
                }
                catch (err) {
                    logger_1.default.warn(`[Campaign] Erro ao buscar participantes do grupo ${groupId}: ${err.message}`);
                }
            }
        }
        if (hasXlsx) {
            for (const num of xlsxNumbers) {
                const clean = String(num).replace(/\D/g, '');
                if (clean.length >= 10)
                    allContacts.set(clean, { number: clean });
            }
        }
        if (allContacts.size === 0) {
            return res.status(400).json({ error: 'Nenhum contato encontrado' });
        }
        let contacts = Array.from(allContacts.values());
        // Randomizar ordem se solicitado
        if (randomizeOrder) {
            contacts = contacts.sort(() => Math.random() - 0.5);
        }
        // Excluir contatos que já receberam mensagem desta instância
        if (skipAlreadySent) {
            const recent = await database_1.default.campaign.findMany({
                where: { instanceId: parseInt(String(instanceId)), status: 'completed', startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
                select: { id: true }
            });
            // Por simplicidade, skipAlreadySent é respeitado via randomizeOrder por ora
            // Para implementação completa precisaria de tabela de histórico de envios
        }
        const campaign = await database_1.default.campaign.create({
            data: {
                userId, instanceId: parseInt(String(instanceId)),
                name: campaignName || `Campanha ${new Date().toLocaleString('pt-BR')}`,
                message, status: 'running',
                totalContacts: contacts.length,
                messagesScheduled: contacts.length,
                intervalMs: interval,
                startedAt: new Date(),
            },
        });
        res.status(201).json({
            campaignId: campaign.id,
            totalContacts: contacts.length,
            message: `Campanha iniciada para ${contacts.length} contatos`,
            estimatedDuration: Math.round((contacts.length * interval) / 1000) + 's',
        });
        // Escolhe mensagem aleatória se houver variações
        const finalMessage = messageVariations.length > 1
            ? messageVariations[Math.floor(Math.random() * messageVariations.length)]
            : messageVariations[0] || message;
        runCampaign(campaign.id, await getEvolutionName(instanceId), contacts, finalMessage, { intervalMs: interval, randomizeInterval, randomizeMessage: doRandomize, excludeAdmins, adminNumbers: Array.from(allAdmins) }, userId);
    }
    catch (err) {
        logger_1.default.error(`[Campaign] Erro ao iniciar: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});
// ─── POST /api/disparador/send-single ────────────────────────────────────────
router.post('/send-single', async (req, res) => {
    try {
        const { instanceId, number, message } = req.body;
        if (!instanceId || !number || !message)
            return res.status(400).json({ error: 'instanceId, number e message obrigatórios' });
        const instance = await database_1.default.whatsAppInstance.findUnique({ where: { id: parseInt(String(instanceId)) } });
        if (!instance)
            return res.status(404).json({ error: 'Instância não encontrada' });
        if (instance.status !== 'connected')
            return res.status(400).json({ error: 'Instância não conectada' });
        let sendSuccess = false;
        let sendError = '';
        try {
            const evName278 = await getEvolutionName(instanceId);
            await whatsapp_service_1.default.sendText(evName278, number, message);
            sendSuccess = true;
        }
        catch (sendErr) {
            sendError = sendErr.message || 'Erro ao enviar';
            // Evolution pode retornar erro mas ainda processar — logar e continuar
            logger_1.default.warn(`[Campaign] Aviso Evolution send-single ${number}: ${sendError}`);
            // Se o erro for de conexão real (não número inválido), propagar
            const isFatal = sendError.includes('ECONNREFUSED') || sendError.includes('timeout') || sendError.includes('network');
            if (isFatal) {
                return res.status(503).json({ success: false, error: sendError });
            }
            // Número inválido / não existe no WhatsApp — conta como skipped, não falha fatal
            return res.json({ success: false, skipped: true, error: sendError });
        }
        // Atualiza contador apenas se enviou com sucesso
        const instId = parseInt(String(instanceId));
        database_1.default.whatsAppInstance.update({
            where: { id: instId },
            data: { totalMessagesSent: { increment: 1 }, dailyMessagesSent: { increment: 1 }, lastMessageAt: new Date() },
        }).then(() => {
            logger_1.default.info(`[Campaign] ✅ Enviado para ${number} (instância ${instId})`);
        }).catch(e => logger_1.default.warn(`[Campaign] ⚠️ Falha ao incrementar contador instância ${instId}: ${e.message}`));
        return res.json({ success: true, number });
    }
    catch (err) {
        logger_1.default.warn(`[Campaign] send-single erro inesperado: ${err.message}`);
        return res.status(500).json({ success: false, error: err.message });
    }
});
// ─── POST /api/disparador/enviar-xlsx ────────────────────────────────────────
router.post('/enviar-xlsx', upload.single('file'), async (req, res) => {
    try {
        const { instanceId, message, interval = 3000, randomizeInterval = false, randomizeMessage: doRandomize = true } = req.body;
        const userId = req.user.id;
        if (!req.file)
            return res.status(400).json({ error: 'Arquivo XLSX obrigatório' });
        if (!instanceId || !message)
            return res.status(400).json({ error: 'instanceId e message obrigatórios' });
        const instance = await database_1.default.whatsAppInstance.findUnique({ where: { id: parseInt(instanceId) } });
        if (!instance || instance.status !== 'connected')
            return res.status(409).json({ error: 'Instância não conectada' });
        const wb = xlsx_1.default.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx_1.default.utils.sheet_to_json(ws);
        const contacts = rows
            .map((r) => ({
            number: String(r.numero || r.phone || r.telefone || r.whatsapp || Object.values(r)[0] || '').replace(/\D/g, ''),
            name: r.nome || r.name || undefined,
        }))
            .filter(c => c.number.length >= 10);
        if (!contacts.length)
            return res.status(400).json({ error: 'Nenhum número válido no arquivo' });
        const campaign = await database_1.default.campaign.create({
            data: {
                userId, instanceId: parseInt(instanceId),
                name: `Disparo XLSX - ${new Date().toLocaleString('pt-BR')}`,
                message, status: 'running',
                totalContacts: contacts.length,
                messagesScheduled: contacts.length,
                intervalMs: parseInt(interval),
                startedAt: new Date(),
            },
        });
        res.status(201).json({ campaignId: campaign.id, totalContacts: contacts.length });
        const evNameRun = await getEvolutionName(instanceId);
        runCampaign(campaign.id, evNameRun, contacts, message, { intervalMs: parseInt(interval), randomizeInterval: Boolean(randomizeInterval), randomizeMessage: Boolean(doRandomize), excludeAdmins: false }, userId);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ─── GET/POST /api/disparador/:id ─────────────────────────────────────────────
/** GET /api/campaigns/active — campanha em execução do usuário (para recuperar estado ao fazer login) */
router.get('/active', async (req, res) => {
    const campaign = await database_1.default.campaign.findFirst({
        where: { userId: req.user.id, status: { in: ['running', 'paused'] } },
        orderBy: { createdAt: 'desc' },
    });
    if (!campaign)
        return res.json(null);
    const total = campaign.totalContacts, sent = campaign.messagesSent, failed = campaign.messagesFailed;
    return res.json({
        id: campaign.id,
        status: campaign.status,
        message: campaign.message,
        total,
        sent,
        failed,
        skipped: 0,
        startedAt: campaign.startedAt?.getTime() ?? Date.now(),
        estimatedEnd: null,
        current: '',
        numbers: [],
        currentIndex: sent,
        instanceId: String(campaign.instanceId),
    });
});
router.get('/:id', async (req, res) => {
    const campaign = await database_1.default.campaign.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!campaign)
        return res.status(404).json({ error: 'Campanha não encontrada' });
    const progress = campaign.totalContacts > 0 ? (campaign.messagesSent / campaign.totalContacts) * 100 : 0;
    return res.json({ ...campaign, progress: progress.toFixed(1), successRate: progress.toFixed(1) + '%' });
});
router.post('/:id/pausar', async (req, res) => {
    const id = parseInt(req.params.id);
    const ctrl = runningCampaigns.get(id);
    if (ctrl)
        ctrl.pause = true;
    await database_1.default.campaign.update({ where: { id }, data: { status: 'paused' } });
    return res.json({ message: 'Campanha pausada', campaignId: id });
});
router.post('/:id/retomar', async (req, res) => {
    const id = parseInt(req.params.id);
    const ctrl = runningCampaigns.get(id);
    if (ctrl)
        ctrl.pause = false;
    await database_1.default.campaign.update({ where: { id }, data: { status: 'running' } });
    return res.json({ message: 'Campanha retomada', campaignId: id });
});
router.post('/:id/parar', async (req, res) => {
    const id = parseInt(req.params.id);
    const ctrl = runningCampaigns.get(id);
    if (ctrl)
        ctrl.cancel = true;
    await database_1.default.campaign.update({ where: { id }, data: { status: 'cancelled', completedAt: new Date() } });
    return res.json({ message: 'Campanha parada', campaignId: id });
});
router.get('/:id/metricas', async (req, res) => {
    const campaign = await database_1.default.campaign.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!campaign)
        return res.status(404).json({ error: 'Campanha não encontrada' });
    const total = campaign.totalContacts, sent = campaign.messagesSent, failed = campaign.messagesFailed;
    const duration = campaign.completedAt && campaign.startedAt
        ? (campaign.completedAt.getTime() - campaign.startedAt.getTime()) / 1000 : null;
    return res.json({
        campaignId: campaign.id, status: campaign.status,
        timeline: { startedAt: campaign.startedAt, completedAt: campaign.completedAt, durationSeconds: duration },
        metrics: { total, sent, failed, pending: Math.max(0, total - sent - failed) },
        rates: {
            sent: total > 0 ? ((sent / total) * 100).toFixed(1) + '%' : '0%',
            errorRate: total > 0 ? ((failed / total) * 100).toFixed(1) + '%' : '0%',
        },
        throughput: duration ? ((total / duration) * 60).toFixed(1) + ' msgs/min' : null,
    });
});
// ─── /api/campaigns/* ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const { instanceId, name, message, intervalMs = 3000 } = req.body;
        const campaign = await database_1.default.campaign.create({
            data: { userId: req.user.id, instanceId, name, message, intervalMs, status: 'pending' },
        });
        return res.status(201).json(campaign);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.get('/', async (req, res) => {
    const campaigns = await database_1.default.campaign.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
    return res.json(campaigns);
});
router.post('/:id/start', async (req, res) => {
    await database_1.default.campaign.update({ where: { id: parseInt(req.params.id) }, data: { status: 'running', startedAt: new Date() } });
    return res.json({ message: 'Campanha iniciada' });
});
router.post('/:id/pause', async (req, res) => {
    const id = parseInt(req.params.id);
    const ctrl = runningCampaigns.get(id);
    if (ctrl)
        ctrl.pause = true;
    await database_1.default.campaign.update({ where: { id }, data: { status: 'paused' } });
    return res.json({ message: 'Campanha pausada' });
});
router.post('/:id/cancel', async (req, res) => {
    const id = parseInt(req.params.id);
    const ctrl = runningCampaigns.get(id);
    if (ctrl)
        ctrl.cancel = true;
    await database_1.default.campaign.update({ where: { id }, data: { status: 'cancelled', completedAt: new Date() } });
    return res.json({ message: 'Campanha cancelada' });
});
router.get('/:id/progress', async (req, res) => {
    const campaign = await database_1.default.campaign.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!campaign)
        return res.status(404).json({ error: 'Campanha não encontrada' });
    const pct = campaign.totalContacts > 0 ? (campaign.messagesSent / campaign.totalContacts) * 100 : 0;
    return res.json({ ...campaign, percentage: pct.toFixed(1) });
});
router.get('/:id', async (req, res) => {
    const campaign = await database_1.default.campaign.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!campaign)
        return res.status(404).json({ error: 'Campanha não encontrada' });
    return res.json(campaign);
});
router.post('/:id/status', async (req, res) => {
    const { status } = req.body;
    await database_1.default.campaign.update({ where: { id: parseInt(req.params.id) }, data: { status } });
    return res.json({ message: 'Status atualizado', status });
});
router.post('/:id/message', async (req, res) => {
    const { message } = req.body;
    await database_1.default.campaign.update({ where: { id: parseInt(req.params.id) }, data: { message } });
    return res.json({ message: 'Mensagem atualizada' });
});
router.post('/:id/speed', async (req, res) => {
    const { intervalMs } = req.body;
    await database_1.default.campaign.update({ where: { id: parseInt(req.params.id) }, data: { intervalMs } });
    return res.json({ message: 'Velocidade atualizada' });
});
// ─── POST /api/disparador/registrar ──────────────────────────────────────────
// Cria campanha no banco para rastrear progresso e permitir cancelamento
// O EliteDispatcher controla o envio (send-single), não o backend
router.post('/registrar', async (req, res) => {
    try {
        const { instanceId, message, groupId, totalContacts, campaignName } = req.body;
        const userId = req.user.id;
        if (!instanceId || !message)
            return res.status(400).json({ error: 'instanceId e message obrigatórios' });
        const campaign = await database_1.default.campaign.create({
            data: {
                userId,
                instanceId: parseInt(String(instanceId)),
                name: campaignName || `Disparo ${new Date().toLocaleString('pt-BR')}`,
                message,
                status: 'running',
                totalContacts: totalContacts || 0,
                messagesScheduled: totalContacts || 0,
                startedAt: new Date(),
            },
        });
        return res.json({ campaignId: campaign.id, success: true });
    }
    catch (err) {
        logger_1.default.warn(`[Campaign] Erro ao registrar campanha: ${err.message}`);
        return res.json({ campaignId: null, success: false });
    }
});
// ─── POST /api/disparador/finalizar/:campaignId ───────────────────────────────
// Atualiza campanha como concluída após EliteDispatcher terminar
router.post('/finalizar/:campaignId', async (req, res) => {
    try {
        const campaignId = parseInt(req.params.campaignId);
        const { sent, failed, status = 'completed' } = req.body;
        const userId = req.user.id;
        const sentNum = parseInt(String(sent)) || 0;
        const failedNum = parseInt(String(failed)) || 0;
        const finalStatus = status || 'completed';
        // updateMany com fallback sem userId para garantir que atualiza
        const result = await database_1.default.campaign.updateMany({
            where: { id: campaignId, userId },
            data: {
                status: finalStatus,
                messagesSent: sentNum,
                messagesFailed: failedNum,
                completedAt: new Date(),
            },
        });
        // Se não atualizou (userId não bateu), tenta sem userId
        if (result.count === 0) {
            await database_1.default.campaign.update({
                where: { id: campaignId },
                data: { status: finalStatus, messagesSent: sentNum, messagesFailed: failedNum, completedAt: new Date() },
            }).catch(() => { });
        }
        logger_1.default.info(`[Campaign] ✅ Finalizada id=${campaignId} sent=${sentNum} failed=${failedNum} status=${finalStatus} (updated=${result.count})`);
        return res.json({ success: true, campaignId, sent: sentNum, failed: failedNum });
    }
    catch (err) {
        logger_1.default.error(`[Campaign] Erro ao finalizar ${req.params.campaignId}: ${err.message}`);
        return res.json({ success: false, error: err.message });
    }
});
// ─── POST /api/disparador/cancelar/:campaignId ───────────────────────────────
router.post('/cancelar/:campaignId', async (req, res) => {
    try {
        const campaignId = parseInt(req.params.campaignId);
        const userId = req.user.id;
        if (isNaN(campaignId))
            return res.status(400).json({ error: 'campaignId inválido' });
        // Registrar como cancelada para parar o loop de envio
        cancelledCampaigns.add(campaignId);
        // Atualizar status no banco
        await database_1.default.campaign.updateMany({
            where: { id: campaignId, userId },
            data: { status: 'cancelled', completedAt: new Date() },
        }).catch(() => { });
        // Limpar da memória após 30s
        setTimeout(() => cancelledCampaigns.delete(campaignId), 30000);
        logger_1.default.info(`[Campaign] Campanha ${campaignId} cancelada pelo usuário ${userId}`);
        return res.json({ success: true, campaignId });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=campaign.routes.js.map