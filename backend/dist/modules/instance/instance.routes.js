"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
const whatsapp_service_1 = __importDefault(require("../../services/whatsapp.service"));
const socket_server_1 = require("../../sockets/socket.server");
const logger_1 = __importDefault(require("../../utils/logger"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
const instanceName = (id) => `instance_${id}`;
/** GET /api/instances */
router.get('/', async (req, res) => {
    try {
        // Admin vê apenas suas próprias instâncias no dashboard normal
        // Para ver instâncias de todos os usuários, usar o painel admin
        const where = { userId: req.user.id, isActive: true, name: { not: { startsWith: 'deleted_' } } };
        const instances = await database_1.default.whatsAppInstance.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        return res.json({ data: instances, total: instances.length });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Limite de instâncias por plano
const PLAN_LIMITS = {
    basic: 1,
    pro: 3,
    enterprise: 10,
};
/** POST /api/instances */
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name)
            return res.status(400).json({ error: 'Nome é obrigatório' });
        // Verificar limite do plano
        const plan = req.user.plan || 'basic';
        const limit = PLAN_LIMITS[plan] ?? 1;
        const count = await database_1.default.whatsAppInstance.count({
            where: { userId: req.user.id, isActive: true },
        });
        if (count >= limit) {
            return res.status(403).json({
                error: `Limite de instâncias atingido para o plano ${plan} (máx: ${limit}). Faça upgrade para criar mais.`,
                limit,
                current: count,
                plan,
            });
        }
        const instance = await database_1.default.whatsAppInstance.create({
            data: { userId: req.user.id, name: name.trim(), status: 'disconnected' },
        });
        logger_1.default.info(`[Instance] Criada: ${instance.id} (${instance.name}) — plano ${plan} (${count + 1}/${limit})`);
        return res.status(201).json(instance);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/** POST /api/instances/:id/connect */
router.post('/:id/connect', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!id || isNaN(id))
            return res.status(400).json({ error: 'ID inválido' });
        const instance = await database_1.default.whatsAppInstance.findUnique({ where: { id } });
        if (!instance)
            return res.status(404).json({ error: 'Instância não encontrada' });
        // Usar o nome real da instância salvo no banco (ex: "vvenda"), não "instance_1"
        // Isso garante que o webhook bate com o nome correto
        const evName = instance.name || instanceName(id);
        const webhookUrl = process.env.WEBHOOK_URL || 'http://host.docker.internal:3001/api/webhook/evolution';
        const WEBHOOK_EVENTS = ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'GROUPS_UPSERT', 'GROUP_UPDATE'];
        // 0. Bloquear se outro connect já em andamento para este usuário
        const alreadyConnecting = await database_1.default.whatsAppInstance.findFirst({
            where: { userId: instance.userId, status: 'connecting', isActive: true, id: { not: id } },
        });
        if (alreadyConnecting) {
            return res.status(429).json({
                error: `Aguarde — "${alreadyConnecting.name}" já está conectando. Finalize antes de conectar outra.`,
                instanceConnecting: alreadyConnecting.name,
            });
        }
        // 0b. Limitar tentativas de QR (máx 3 por instância em 5 minutos)
        // Evita bloqueio do WhatsApp por excesso de tentativas
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (instance.updatedAt > fiveMinutesAgo && instance.status === 'connecting') {
            // Já tentou recentemente — deixar passar mas logar
            logger_1.default.warn(`[Instance] ${evName} — múltiplas tentativas de QR em 5min`);
        }
        // 1. Verifica se já existe e está conectada na Evolution
        try {
            const state = await whatsapp_service_1.default.getInstanceState(evName);
            if (state === 'open') {
                await database_1.default.whatsAppInstance.update({ where: { id }, data: { status: 'connected', qrCode: null } });
                await whatsapp_service_1.default.registerWebhook(evName).catch(() => { });
                return res.json({ instanceId: id, qrCode: null, status: 'connected', message: 'WhatsApp já conectado' });
            }
        }
        catch { /* ainda não existe na Evolution */ }
        // 2. Cria instância na Evolution
        // Se já existe (403/409), deleta e recria para garantir sessão limpa e QR válido
        let createData = null;
        try {
            createData = await whatsapp_service_1.default.createInstance(evName);
            logger_1.default.info(`[Instance] ${evName} criada na Evolution`);
        }
        catch (err) {
            const status = err.response?.status || 0;
            const msg = err.message || '';
            if (status === 403 || status === 409 || msg.includes('already')) {
                // Instância existe mas pode estar com sessão corrompida — deletar e recriar
                logger_1.default.info(`[Instance] ${evName} já existe na Evolution — deletando e recriando para sessão limpa`);
                try {
                    await whatsapp_service_1.default.logoutInstance(evName).catch(() => { });
                    await new Promise(r => setTimeout(r, 1000));
                    await whatsapp_service_1.default.deleteInstance(evName);
                    await new Promise(r => setTimeout(r, 2000));
                    createData = await whatsapp_service_1.default.createInstance(evName);
                    logger_1.default.info(`[Instance] ${evName} recriada na Evolution com sucesso`);
                }
                catch (err2) {
                    logger_1.default.warn(`[Instance] Falha ao recriar ${evName}: ${err2.message}`);
                }
            }
            else {
                logger_1.default.warn(`[Instance] Criação na Evolution: ${err.message}`);
            }
        }
        // 3. Registra webhook
        await whatsapp_service_1.default.registerWebhook(evName).catch(() => { });
        // 4. v2.3.6: QR vem direto no create (createData.qrcode.base64)
        // fallback: busca via /instance/connect
        let qrCode = null;
        // Tenta QR do create
        const createB64 = createData?.qrcode?.base64;
        if (createB64 && createB64.length > 100) {
            qrCode = createB64.startsWith('data:image') ? createB64 : `data:image/png;base64,${createB64}`;
            logger_1.default.info(`✅ [Instance] QR obtido via create para ${evName}`);
        }
        // Fallback: connect
        if (!qrCode) {
            await new Promise(r => setTimeout(r, 2000));
            try {
                const connectRes = await whatsapp_service_1.default.connectInstance(evName);
                const b64 = connectRes?.base64 || connectRes?.qrcode?.base64;
                if (b64 && b64.length > 100) {
                    qrCode = b64.startsWith('data:image') ? b64 : `data:image/png;base64,${b64}`;
                    logger_1.default.info(`✅ [Instance] QR obtido via connect para ${evName}`);
                }
            }
            catch (err) {
                logger_1.default.warn(`[Instance] connect: ${err.message}`);
            }
        }
        if (qrCode) {
            await database_1.default.whatsAppInstance.update({ where: { id }, data: { qrCode, status: 'connecting' } });
            (0, socket_server_1.emitToUser)(instance.userId, 'qr_code', { instanceId: id, qrCode });
        }
        else {
            await database_1.default.whatsAppInstance.update({ where: { id }, data: { status: 'connecting' } });
            logger_1.default.warn(`[Instance] QR não disponível para ${evName}`);
        }
        return res.json({ instanceId: id, qrCode, status: qrCode ? 'connecting' : 'pending' });
    }
    catch (err) {
        logger_1.default.error(`[Instance] Connect error: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});
/** GET /api/instances/:id/qr */
router.get('/:id/qr', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!id || isNaN(id))
            return res.status(400).json({ error: 'ID inválido' });
        const instance = await database_1.default.whatsAppInstance.findUnique({ where: { id }, select: { qrCode: true, status: true } });
        if (!instance)
            return res.status(404).json({ error: 'Instância não encontrada' });
        return res.json({ qrCode: instance.qrCode, status: instance.status });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/** GET /api/instances/:id/status — polling */
router.get('/:id/status', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const instance = await database_1.default.whatsAppInstance.findUnique({ where: { id }, select: { status: true, phoneNumber: true } });
        if (!instance)
            return res.status(404).json({ error: 'Instância não encontrada' });
        return res.json(instance);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/** GET /api/instances/:id/check-status — polling do frontend */
router.get('/:id/check-status', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const instance = await database_1.default.whatsAppInstance.findUnique({ where: { id } });
        if (!instance)
            return res.status(404).json({ error: 'Instância não encontrada' });
        // Consulta Evolution diretamente
        // Usar o nome real da instância salvo no banco (ex: "vvenda"), não "instance_1"
        // Isso garante que o webhook bate com o nome correto
        const evName = instance.name || instanceName(id);
        const state = await whatsapp_service_1.default.getInstanceState(evName);
        if (state === 'open' && instance.status !== 'connected') {
            // Busca número do dono — fetchInstances já normalizado para v1/v2
            let phoneNumber = instance.phoneNumber;
            try {
                const all = await whatsapp_service_1.default.fetchInstances();
                const found = all.find((i) => i.instanceName === evName);
                // v2: ownerJid; v1: owner
                const owner = found?.ownerJid || found?.owner;
                if (owner)
                    phoneNumber = owner.replace('@s.whatsapp.net', '').replace('@c.us', '');
            }
            catch { /* ignora */ }
            await database_1.default.whatsAppInstance.update({
                where: { id },
                data: { status: 'connected', qrCode: null, connectedAt: new Date(), ...(phoneNumber ? { phoneNumber } : {}) },
            });
            (0, socket_server_1.emitToUser)(instance.userId, 'whatsapp_connected', { instanceId: id, phoneNumber, status: 'connected' });
            logger_1.default.info(`✅ [check-status] ${evName} conectada${phoneNumber ? ' (' + phoneNumber + ')' : ''}`);
        }
        else if (state === 'close' && instance.status === 'connected') {
            await database_1.default.whatsAppInstance.update({ where: { id }, data: { status: 'disconnected', qrCode: null } });
            (0, socket_server_1.emitToUser)(instance.userId, 'whatsapp_disconnected', { instanceId: id });
        }
        const updated = await database_1.default.whatsAppInstance.findUnique({ where: { id }, select: { status: true, phoneNumber: true, qrCode: true } });
        return res.json(updated);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/** DELETE /api/instances/:id */
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const instance = await database_1.default.whatsAppInstance.findUnique({ where: { id } });
        if (!instance)
            return res.status(404).json({ error: 'Instância não encontrada' });
        if (instance.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        // Usar o nome real da instância salvo no banco (ex: "vvenda"), não "instance_1"
        // Isso garante que o webhook bate com o nome correto
        const evName = instance.name || instanceName(id);
        // Tenta logout e delete na Evolution (ignora 404 — pode não existir)
        try {
            await whatsapp_service_1.default.logoutInstance(evName);
        }
        catch { /* ignora */ }
        try {
            await whatsapp_service_1.default.deleteInstance(evName);
        }
        catch { /* ignora */ }
        // Cancelar campanhas ativas desta instância
        await database_1.default.campaign.updateMany({
            where: { instanceId: id, status: { in: ['running', 'paused', 'pending'] } },
            data: { status: 'cancelled', completedAt: new Date() },
        });
        // Remover grupos e warmup state
        await database_1.default.whatsAppGroup.deleteMany({ where: { instanceId: id } });
        await database_1.default.$executeRaw `DELETE FROM warmup_states WHERE instance_id = ${id}`.catch(() => { });
        // Desvincular campanhas antigas (set instanceId para null não é possível sem schema change)
        // Usar soft-delete na instância em vez de hard-delete
        await database_1.default.whatsAppInstance.update({
            where: { id },
            data: { isActive: false, status: 'disconnected', qrCode: null, name: `deleted_${id}_${Date.now()}` },
        });
        logger_1.default.info(`[Instance] Removida (soft-delete): ${id} (${evName})`);
        return res.json({ message: 'Instância removida com sucesso' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/** GET /api/instances/cleanup/validate-plan-limit */
router.get('/cleanup/validate-plan-limit', async (req, res) => {
    const count = await database_1.default.whatsAppInstance.count({ where: { userId: req.user.id, isActive: true } });
    const limits = { basic: 1, pro: 5, enterprise: 999 };
    const limit = limits[req.user.plan] || 1;
    return res.json({ count, limit, canCreate: count < limit });
});
exports.default = router;
//# sourceMappingURL=instance.routes.js.map