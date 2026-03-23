"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../../config/database"));
const groups_service_1 = require("../../services/groups.service");
const socket_server_1 = require("../../sockets/socket.server");
const whatsapp_service_1 = __importDefault(require("../../services/whatsapp.service"));
const logger_1 = __importDefault(require("../../utils/logger"));
const router = (0, express_1.Router)();
async function findInstance(instanceName) {
    if (!instanceName)
        return null;
    // Tenta por nome direto na tabela
    let inst = await database_1.default.whatsAppInstance.findFirst({ where: { name: instanceName, isActive: true } });
    if (inst)
        return inst;
    // Tenta por padrão instance_ID
    const match = instanceName.match(/^instance_(\d+)$/);
    if (match) {
        inst = await database_1.default.whatsAppInstance.findFirst({ where: { id: parseInt(match[1]), isActive: true } });
        if (inst)
            return inst;
    }
    return null;
}
/** POST /api/webhook/evolution */
// v2 com byEvents:true manda para /evolution/EVENT_NAME — captura ambos
router.post('/evolution/:event?', async (req, res) => {
    // Responde IMEDIATAMENTE — Evolution tem timeout curto
    res.json({ received: true });
    try {
        const body = req.body;
        // v2 byEvents: event vem na URL (/evolution/QRCODE_UPDATED) ou no body
        const eventFromParam = req.params.event || '';
        const event = body?.event || body?.type || eventFromParam || '';
        const instanceName = body?.instance || body?.instanceName ||
            body?.data?.instance?.instanceName ||
            body?.data?.instanceName || '';
        // Log apenas eventos relevantes — silencia messages.upsert para não spammar
        const silentEvents = ['messages.upsert', 'messages_upsert', 'MESSAGES_UPSERT', 'messages.update', 'message.upsert'];
        const evtNorm = event.toLowerCase().replace(/_/g, '.');
        if (!silentEvents.some(s => s.toLowerCase() === evtNorm || evtNorm.includes('message'))) {
            logger_1.default.info(`[Webhook] ▶ event="${event}" instance="${instanceName}" keys=${Object.keys(body || {}).join(',')}`);
        }
        if (!event || !instanceName) {
            // v2 pode mandar formato diferente — loga body completo
            logger_1.default.warn(`[Webhook] Payload não mapeado: ${JSON.stringify(body).substring(0, 500)}`);
            return;
        }
        const instance = await findInstance(instanceName);
        if (!instance) {
            logger_1.default.warn(`[Webhook] Instância não encontrada: ${instanceName}`);
            return;
        }
        // v2: eventos em lowercase com ponto (connection.update, qrcode.updated)
        // v1: eventos em uppercase com underscore (CONNECTION_UPDATE, QRCODE_UPDATED)
        const evt = event.toUpperCase().replace(/\./g, '_');
        // ─── CONNECTION_UPDATE ────────────────────────────────────────────────────
        if (evt === 'CONNECTION_UPDATE') {
            const state = body?.data?.state || body?.data?.status || body?.state || '';
            logger_1.default.info(`[Webhook] CONNECTION_UPDATE: ${instanceName} → "${state}" | data=${JSON.stringify(body?.data || {}).substring(0, 150)}`);
            if (state === 'open') {
                // Tenta extrair número de várias posições do payload
                const ownerJid = body?.data?.instance?.owner ||
                    body?.data?.owner ||
                    body?.owner ||
                    body?.sender ||
                    body?.data?.sender;
                let phoneNumber = ownerJid
                    ? ownerJid.replace('@s.whatsapp.net', '').replace('@c.us', '')
                    : instance.phoneNumber;
                // Se não veio no payload, busca na Evolution
                if (!phoneNumber) {
                    try {
                        const all = await whatsapp_service_1.default.fetchInstances();
                        const found = all.find((i) => (i.instance?.instanceName || i.instanceName) === instanceName);
                        const owner = found?.instance?.owner || found?.owner;
                        if (owner)
                            phoneNumber = owner.replace('@s.whatsapp.net', '').replace('@c.us', '');
                    }
                    catch { /* ignora */ }
                }
                await database_1.default.whatsAppInstance.update({
                    where: { id: instance.id },
                    data: { status: 'connected', connectedAt: new Date(), qrCode: null, ...(phoneNumber ? { phoneNumber } : {}) },
                });
                logger_1.default.info(`✅ [Webhook] ${instanceName} CONECTADA${phoneNumber ? ` (${phoneNumber})` : ''}`);
                const payload = { instanceId: instance.id, instanceName, phoneNumber, status: 'connected' };
                (0, socket_server_1.emitToUser)(instance.userId, 'whatsapp_connected', payload);
                // Dispara sync de grupos 45s após conectar (WhatsApp precisa sincronizar primeiro)
                setTimeout(() => {
                    (0, groups_service_1.syncGroupsBackground)(instance.id).catch(() => { });
                }, 45000);
                logger_1.default.info(`[Webhook] Sync de grupos agendado em 45s para ${instanceName}`);
            }
            else if (state === 'close') {
                if (instance.status === 'connected') {
                    await database_1.default.whatsAppInstance.update({ where: { id: instance.id }, data: { status: 'disconnected', qrCode: null } });
                    logger_1.default.warn(`🔴 [Webhook] ${instanceName} DESCONECTADA`);
                    (0, socket_server_1.emitToUser)(instance.userId, 'whatsapp_disconnected', { instanceId: instance.id, status: 'disconnected' });
                }
            }
        }
        // ─── QRCODE_UPDATED ───────────────────────────────────────────────────────
        if (evt === 'QRCODE_UPDATED' || evt === 'QRCODE_UPDATE') {
            const qrCode = body?.data?.qrcode?.base64 ||
                body?.data?.base64 ||
                body?.qrcode?.base64 ||
                body?.base64;
            if (qrCode && qrCode.length > 500) {
                const normalized = qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`;
                await database_1.default.whatsAppInstance.update({ where: { id: instance.id }, data: { qrCode: normalized, status: 'connecting' } });
                logger_1.default.info(`📱 [Webhook] QR atualizado para ${instanceName}`);
                (0, socket_server_1.emitToUser)(instance.userId, 'qr_code', { instanceId: instance.id, qrCode: normalized });
            }
        }
        // ─── GROUPS_UPSERT — grupos chegam automaticamente na conexão ─────────────
        if (evt === 'GROUPS_UPSERT' || evt === 'GROUP_UPSERT' || evt === 'GROUP.UPSERT') {
            const raw = body?.data || body?.groups || [];
            const groupList = Array.isArray(raw) ? raw : [raw];
            if (groupList.length > 0) {
                logger_1.default.info(`[Webhook] GROUPS_UPSERT: ${groupList.length} grupos para ${instanceName}`);
                await (0, groups_service_1.saveGroupsFromWebhook)(instance.id, groupList);
                (0, socket_server_1.emitToUser)(instance.userId, 'groups_updated', { instanceId: instance.id, total: groupList.length });
            }
        }
        // ─── GROUP_UPDATE ─────────────────────────────────────────────────────────
        if (evt === 'GROUP_UPDATE' || evt === 'GROUP.UPDATE') {
            const raw = body?.data;
            if (raw)
                await (0, groups_service_1.saveGroupsFromWebhook)(instance.id, Array.isArray(raw) ? raw : [raw]);
        }
        // ─── MESSAGES_UPSERT — captura nome do grupo via mensagens recebidas ──────
        // findChats não retorna subject; mas mensagens trazem pushName/subject do grupo
        if (evt === 'MESSAGES_UPSERT' || evt === 'MESSAGES.UPSERT') {
            try {
                const msgs = body?.data || body?.messages || body || [];
                const list = Array.isArray(msgs) ? msgs : [msgs];
                for (const msg of list) {
                    const jid = msg?.key?.remoteJid || msg?.remoteJid || '';
                    if (!jid.includes('@g.us'))
                        continue;
                    // Tenta pegar o nome do grupo de diferentes campos do payload
                    const groupName = msg?.pushName || msg?.subject || msg?.groupName ||
                        msg?.message?.conversation?.substring(0, 50) || null;
                    if (groupName && groupName.length > 1) {
                        await database_1.default.whatsAppGroup.updateMany({
                            where: { instanceId: instance.id, groupId: jid, name: { startsWith: 'Grupo ' } },
                            data: { name: groupName },
                        });
                    }
                }
            }
            catch { /* não crítico */ }
        }
    }
    catch (err) {
        logger_1.default.error(`[Webhook] Erro: ${err.message}`);
    }
});
/** GET /api/webhook/evolution/sync-number/:instanceName */
router.get('/evolution/sync-number/:instanceName', async (req, res) => {
    try {
        const { instanceName } = req.params;
        const state = await whatsapp_service_1.default.getInstanceState(instanceName);
        const instances = await whatsapp_service_1.default.fetchInstances();
        const found = instances.find((i) => (i.instance?.instanceName || i.instanceName) === instanceName);
        const owner = found?.instance?.owner || found?.owner;
        const phoneNumber = owner ? owner.replace('@s.whatsapp.net', '').replace('@c.us', '') : null;
        const instance = await findInstance(instanceName);
        if (instance && phoneNumber) {
            await database_1.default.whatsAppInstance.update({ where: { id: instance.id }, data: { phoneNumber } });
        }
        return res.json({ instanceName, phoneNumber, state });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/** POST /api/webhook/diggion — pagamentos */
router.post('/diggion', async (req, res) => {
    try {
        const { event, customer_email, amount, transaction_id, metadata } = req.body;
        if (event === 'payment.approved') {
            const user = await database_1.default.user.findUnique({ where: { email: customer_email } });
            if (user) {
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + (metadata?.duration || 30));
                await database_1.default.user.update({ where: { id: user.id }, data: { plan: metadata?.plan, planExpiresAt: expiresAt } });
                await database_1.default.payment.create({
                    data: { userId: user.id, diggionTransactionId: transaction_id, amount, status: 'approved', plan: metadata?.plan, planDuration: metadata?.duration, expiresAt },
                });
            }
        }
        return res.json({ received: true });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=webhook.routes.js.map