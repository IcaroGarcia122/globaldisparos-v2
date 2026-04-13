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
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const groups_service_1 = require("../../services/groups.service");
const whatsapp_service_1 = __importDefault(require("../../services/whatsapp.service"));
const database_1 = __importDefault(require("../../config/database"));
const logger_1 = __importDefault(require("../../utils/logger"));
const router = (0, express_1.Router)();
/** GET /api/groups?instanceId=X */
router.get('/', auth_middleware_1.authenticate, async (req, res) => {
    const instanceId = parseInt(req.query.instanceId);
    if (!instanceId)
        return res.status(400).json({ error: 'instanceId obrigatório' });
    const { groups, source } = await (0, groups_service_1.getGroups)(instanceId);
    if (groups.length > 0) {
        // Retorna cache imediatamente, mas dispara sync em background para pegar grupos novos
        const instance = await database_1.default.whatsAppInstance.findUnique({
            where: { id: instanceId }, select: { status: true },
        }).catch(() => null);
        if (instance?.status === 'connected' && !(0, groups_service_1.isSyncing)(instanceId)) {
            (0, groups_service_1.syncGroupsBackground)(instanceId).catch(() => { });
        }
        return res.json({ groups, loading: false, total: groups.length, source });
    }
    const instance = await database_1.default.whatsAppInstance.findUnique({
        where: { id: instanceId }, select: { status: true },
    }).catch(() => null);
    if (instance?.status !== 'connected') {
        return res.json({ groups: [], loading: false, total: 0, message: 'Instância não conectada' });
    }
    if ((0, groups_service_1.isSyncing)(instanceId)) {
        return res.json({
            groups: [], loading: true, total: 0,
            message: (0, groups_service_1.getSyncProgress)(instanceId) || 'Sincronizando grupos...',
        });
    }
    (0, groups_service_1.syncGroupsBackground)(instanceId).catch(() => { });
    return res.json({ groups: [], loading: true, total: 0, message: 'Sync iniciado...' });
});
/** GET /api/groups/status/:instanceId */
router.get('/status/:instanceId', auth_middleware_1.authenticate, async (req, res) => {
    const instanceId = parseInt(req.params.instanceId);
    const { groups } = await (0, groups_service_1.getGroups)(instanceId);
    return res.json({
        loading: (0, groups_service_1.isSyncing)(instanceId),
        progress: (0, groups_service_1.getSyncProgress)(instanceId),
        total: groups.length,
        groups,
        done: groups.length > 0,
    });
});
/** GET /api/groups/sync/:instanceId — força sync */
router.get('/sync/:instanceId', auth_middleware_1.authenticate, async (req, res) => {
    const instanceId = parseInt(req.params.instanceId);
    if (!(0, groups_service_1.isSyncing)(instanceId)) {
        (0, groups_service_1.syncGroupsBackground)(instanceId).catch(() => { });
    }
    return res.json({ message: 'Sync iniciado', loading: true });
});
/** POST /api/groups/sync/:instanceId */
router.post('/sync/:instanceId', auth_middleware_1.authenticate, async (req, res) => {
    const instanceId = parseInt(req.params.instanceId);
    if (!(0, groups_service_1.isSyncing)(instanceId)) {
        (0, groups_service_1.syncGroupsBackground)(instanceId).catch(() => { });
    }
    return res.json({ message: 'Sync iniciado', loading: true });
});
/**
 * POST /api/groups/inject/:instanceId
 * Endpoint de debug: injeta grupos manualmente via payload
 * Útil para testar sem depender do webhook
 */
router.post('/inject/:instanceId', auth_middleware_1.authenticate, async (req, res) => {
    const instanceId = parseInt(req.params.instanceId);
    const { groups } = req.body;
    if (!groups?.length)
        return res.status(400).json({ error: 'groups[] obrigatório' });
    const saved = await (0, groups_service_1.saveGroupsFromWebhook)(instanceId, groups);
    return res.json({ saved, message: `${saved} grupos injetados` });
});
/** GET /api/groups/participants/:instanceId/:groupId */
router.get('/participants/:instanceId/:groupId', auth_middleware_1.authenticate, async (req, res) => {
    const instanceId = parseInt(req.params.instanceId);
    const { groupId } = req.params;
    try {
        const result = await (0, groups_service_1.getParticipants)(instanceId, groupId);
        return res.json({ ...result, groupId });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/** GET /api/groups/admin-only/:instanceId — grupos onde a instância é admin/dono */
router.get('/admin-only/:instanceId', auth_middleware_1.authenticate, async (req, res) => {
    const instanceId = parseInt(req.params.instanceId);
    try {
        const instance = await database_1.default.whatsAppInstance.findUnique({
            where: { id: instanceId },
            select: { name: true, phoneNumber: true, status: true },
        });
        const instanceName = instance?.name || `instance_${instanceId}`;
        const ownerPhone = (instance?.phoneNumber || '').replace(/\D/g, '');
        const suffix = ownerPhone.slice(-8);
        // ── Sempre responde do banco (rápido) ─────────────────────────────────────
        const dbGroups = await database_1.default.whatsAppGroup.findMany({
            where: { instanceId },
            orderBy: { name: 'asc' },
            select: { groupId: true, name: true, participantsCount: true, participantsList: true },
        });
        // Banco vazio → dispara sync e retorna vazio
        if (dbGroups.length === 0) {
            if (instance?.status === 'connected')
                (0, groups_service_1.syncGroupsBackground)(instanceId).catch(() => { });
            return res.json({ groups: [], warning: 'Sincronização iniciada. Recarregue em 30 segundos.' });
        }
        // Dispara sync de participantes em background (não bloqueia resposta)
        if (instance?.status === 'connected') {
            (0, groups_service_1.syncAllParticipants)(instanceId, instanceName).catch(() => { });
        }
        // Filtra por admin se tiver dados
        if (ownerPhone) {
            const adminGroups = dbGroups.filter(g => {
                const pl = g.participantsList;
                if (!pl?.admins?.length)
                    return false;
                return pl.admins.some((a) => a.replace(/\D/g, '').endsWith(suffix));
            });
            if (adminGroups.length > 0) {
                logger_1.default.info(`[AdminGroups] ${adminGroups.length}/${dbGroups.length} grupos onde ${ownerPhone} é admin`);
                return res.json({
                    groups: adminGroups.map(g => ({ groupId: g.groupId, name: g.name, participantsCount: g.participantsCount })),
                    source: 'database_admins',
                });
            }
        }
        // Sem dados de admin ainda — retorna todos com aviso
        logger_1.default.info(`[AdminGroups] Sem dados de admin ainda — retornando ${dbGroups.length} grupos`);
        return res.json({
            groups: dbGroups.map(g => ({ groupId: g.groupId, name: g.name, participantsCount: g.participantsCount })),
            source: 'database_all',
            warning: 'Sincronizando dados de admin em background. Recarregue em 30 segundos.',
        });
    }
    catch (err) {
        logger_1.default.error(`[AdminGroups] Erro: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});
router.get('/:groupId/participants', auth_middleware_1.authenticate, async (req, res) => {
    const instanceId = parseInt(req.query.instanceId);
    const { groupId } = req.params;
    if (!instanceId)
        return res.status(400).json({ error: 'instanceId obrigatório' });
    const result = await (0, groups_service_1.getParticipants)(instanceId, groupId);
    return res.json(result.participants.map(p => ({ id: p, jid: `${p}@s.whatsapp.net` })));
});
/** POST /api/groups/:groupId/dispatch */
router.post('/:groupId/dispatch', auth_middleware_1.authenticate, async (req, res) => {
    return res.json({ message: 'Use /api/disparador/iniciar' });
});
/**
 * GET /api/groups/debug/:instanceId/:groupId
 * Testa todos os endpoints de participantes — útil para diagnosticar
 */
router.get('/debug/:instanceId/:groupId', auth_middleware_1.authenticate, async (req, res) => {
    const instanceId = parseInt(req.params.instanceId);
    const groupId = decodeURIComponent(req.params.groupId);
    const instRow = await database_1.default.whatsAppInstance.findUnique({ where: { id: instanceId }, select: { name: true } }).catch(() => null);
    const instanceName = instRow?.name || `instance_${instanceId}`;
    const results = { groupId, endpoints: [] };
    const endpoints = [
        `/group/participants/${instanceName}?groupJid=${encodeURIComponent(groupId)}`,
        `/group/findGroupInfos/${instanceName}/${encodeURIComponent(groupId)}`,
        `/group/participants/${instanceName}/${encodeURIComponent(groupId)}`,
    ];
    const axios = require('axios');
    for (const ep of endpoints) {
        try {
            const r = await axios.get(`${process.env.EVOLUTION_API_URL}${ep}`, {
                headers: { apikey: process.env.EVOLUTION_API_KEY },
                timeout: 15000,
            });
            results.endpoints.push({ ep, status: 200, dataKeys: Object.keys(r.data || {}), participantsCount: r.data?.participants?.length || (Array.isArray(r.data) ? r.data.length : 0) });
        }
        catch (e) {
            results.endpoints.push({ ep, status: e.response?.status || 'timeout', error: e.message });
        }
    }
    return res.json(results);
});
/** POST /api/groups/add-participants/:instanceId/:groupId
 *  Body: { participants: ["5511..."], delaySeconds?: number }
 *  Adiciona um por um com delay configurável (mín 35s)
 */
router.post('/add-participants/:instanceId/:groupId', auth_middleware_1.authenticate, async (req, res) => {
    const instanceId = parseInt(req.params.instanceId);
    const { groupId } = req.params;
    const { participants, delaySeconds = 45 } = req.body;
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json({ error: 'participants deve ser array não vazio' });
    }
    // Delay mínimo de 35s por segurança
    const delay = Math.max(35, parseInt(String(delaySeconds)) || 45);
    try {
        const instance = await database_1.default.whatsAppInstance.findUnique({
            where: { id: instanceId }, select: { name: true },
        });
        const instanceName = instance?.name || `instance_${instanceId}`;
        const success = [];
        const failed = [];
        for (const phone of participants) {
            try {
                await whatsapp_service_1.default.addParticipants(instanceName, groupId, [phone]);
                success.push(phone);
                logger_1.default.info(`[AddParticipants] ✅ ${phone} adicionado ao grupo ${groupId}`);
            }
            catch (err) {
                failed.push(phone);
                logger_1.default.warn(`[AddParticipants] ❌ Falha ${phone}: ${err.message}`);
            }
            // Delay entre cada adição (exceto após o último)
            if (phone !== participants[participants.length - 1]) {
                await new Promise(r => setTimeout(r, delay * 1000));
            }
        }
        return res.json({ success, failed, total: participants.length, delayUsed: delay });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/** GET /api/groups/test-add/:instanceId/:groupId — testa qual endpoint funciona */
router.get('/test-add/:instanceId/:groupId', auth_middleware_1.authenticate, async (req, res) => {
    const instanceId = parseInt(req.params.instanceId);
    const { groupId } = req.params;
    const baseURL = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081').replace('localhost', '127.0.0.1');
    const apiKey = process.env.EVOLUTION_API_KEY || '';
    const instance = await database_1.default.whatsAppInstance.findUnique({ where: { id: instanceId }, select: { name: true } });
    const instanceName = instance?.name || `instance_${instanceId}`;
    const testBody = JSON.stringify({ action: 'add', participants: ['5500000000000@s.whatsapp.net'] });
    const headers = { 'Content-Type': 'application/json', 'apikey': apiKey };
    const endpoints = [
        { method: 'POST', url: `${baseURL}/group/updateParticipant/${instanceName}?groupJid=${groupId}` },
        { method: 'POST', url: `${baseURL}/group/updateParticipant/${instanceName}`, body: JSON.stringify({ groupJid: groupId, action: 'add', participants: [] }) },
        { method: 'PUT', url: `${baseURL}/group/updateParticipant/${instanceName}?groupJid=${groupId}` },
    ];
    const results = [];
    for (const ep of endpoints) {
        try {
            const r = await fetch(ep.url, { method: ep.method, headers, body: ep.body || testBody });
            const text = await r.text();
            results.push({ method: ep.method, url: ep.url, status: r.status, body: text.slice(0, 200) });
        }
        catch (e) {
            results.push({ method: ep.method, url: ep.url, error: e.message });
        }
    }
    return res.json({ instanceName, groupId, results });
});
/** POST /api/groups/sync-participants/:instanceId — sincroniza participantes de todos os grupos */
router.post('/sync-participants/:instanceId', auth_middleware_1.authenticate, async (req, res) => {
    const instanceId = parseInt(req.params.instanceId);
    try {
        const instance = await database_1.default.whatsAppInstance.findUnique({
            where: { id: instanceId }, select: { name: true }
        });
        const instanceName = instance?.name || `instance_${instanceId}`;
        logger_1.default.info(`[Groups] Iniciando sync de participantes para ${instanceName}...`);
        // Responde imediatamente — processo é demorado
        res.json({ message: 'Sincronização iniciada em background. Pode levar 1-3 minutos.', instanceName });
        // Executar em background
        setImmediate(async () => {
            try {
                const evRes = await (await Promise.resolve().then(() => __importStar(require("axios")))).default.get(`/group/fetchAllGroups/${instanceName}?getParticipants=true`, { timeout: 180000 });
                const raw = Array.isArray(evRes.data) ? evRes.data : (evRes.data?.groups || []);
                let synced = 0;
                for (const g of raw) {
                    const gid = g.id || g.jid || '';
                    if (!gid.includes('@g.us') || !g.participants?.length)
                        continue;
                    const participants = [];
                    const admins = [];
                    for (const p of g.participants) {
                        const jid = p.id || p.jid || '';
                        if (jid.endsWith('@lid') || jid.includes('@g.us'))
                            continue; // LID = linked device, não é número real
                        const phone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
                        if (!phone || phone.length < 8 || phone.includes('@'))
                            continue;
                        participants.push(phone);
                        if (p.admin === 'admin' || p.admin === 'superadmin')
                            admins.push(phone);
                    }
                    if (participants.length > 0) {
                        await database_1.default.whatsAppGroup.updateMany({
                            where: { instanceId, groupId: gid },
                            data: {
                                participantsList: { participants, admins },
                                participantsCount: participants.length,
                                participantsSyncedAt: new Date(),
                            },
                        }).catch(() => { });
                        synced++;
                    }
                }
                logger_1.default.info(`[Groups] ✅ Sync participantes concluído: ${synced} grupos atualizados`);
            }
            catch (err) {
                logger_1.default.warn(`[Groups] Sync participantes falhou: ${err.message}`);
            }
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/** GET /api/groups/export-xlsx/:instanceId/:groupId — exporta participantes como CSV ou XLSX */
router.get('/export-xlsx/:instanceId/:groupId', auth_middleware_1.authenticate, async (req, res) => {
    const instanceId = parseInt(req.params.instanceId);
    const { groupId } = req.params;
    const excludeAdmins = req.query.excludeAdmins === 'true';
    const format = (req.query.format || 'csv').toLowerCase(); // 'csv' | 'xlsx'
    try {
        const result = await (0, groups_service_1.getParticipants)(instanceId, groupId);
        const participants = result.participants || [];
        const admins = result.admins || [];
        const row = await database_1.default.whatsAppGroup.findFirst({
            where: { instanceId, groupId },
            select: { name: true },
        });
        if (participants.length === 0) {
            return res.status(404).json({
                error: 'Não foi possível obter os participantes deste grupo. Verifique se a instância está conectada e tente novamente.',
            });
        }
        const list = excludeAdmins
            ? participants.filter((p) => !admins.includes(p))
            : participants;
        const groupName = (row?.name || groupId).replace(/[^a-zA-Z0-9_\-\u00C0-\u017F ]/g, '_').slice(0, 40);
        const date = new Date().toISOString().split('T')[0];
        if (format === 'xlsx') {
            const XLSX = require('xlsx');
            // Single column: just phone numbers
            const wsData = list.map((phone) => [phone]);
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            // Set column width
            ws['!cols'] = [{ wch: 20 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Contatos');
            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            const filename = `contatos_${groupName}_${date}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.send(buf);
        }
        // CSV: one phone number per row, no header
        const bom = '\uFEFF';
        const csv = bom + list.join('\r\n');
        const filename = `contatos_${groupName}_${date}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(csv);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/** POST /api/groups/sync-participants/:instanceId
 *  Busca participantes de TODOS os grupos e salva no banco
 *  Deve ser chamado uma vez para popular o cache inicial
 */
router.post('/sync-participants/:instanceId', auth_middleware_1.authenticate, async (req, res) => {
    const instanceId = parseInt(req.params.instanceId);
    const instance = await database_1.default.whatsAppInstance.findUnique({
        where: { id: instanceId }, select: { name: true }
    });
    const instanceName = instance?.name || `instance_${instanceId}`;
    // Buscar todos os grupos do banco
    const groups = await database_1.default.whatsAppGroup.findMany({
        where: { instanceId },
        select: { groupId: true, name: true }
    });
    if (groups.length === 0) {
        return res.json({ message: 'Nenhum grupo no banco. Sincronize os grupos primeiro.', synced: 0 });
    }
    logger_1.default.info(`[SyncParticipants] Iniciando para ${instanceName} — ${groups.length} grupos`);
    // Processar em background para não travar o request
    res.json({ message: `Sincronizando participantes de ${groups.length} grupos em background...`, total: groups.length });
    // Background
    (async () => {
        let synced = 0;
        const baseURL = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081').replace('localhost', '127.0.0.1');
        const apiKey = process.env.EVOLUTION_API_KEY || '';
        const headers = { 'Content-Type': 'application/json', 'apikey': apiKey };
        for (const g of groups) {
            try {
                const url = `${baseURL}/group/findParticipants/${instanceName}?groupJid=${g.groupId}`;
                const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
                if (!r.ok)
                    continue;
                const data = await r.json();
                const raw = data?.participants || data?.members || (Array.isArray(data) ? data : []);
                if (raw.length === 0)
                    continue;
                const participants = [];
                const admins = [];
                for (const p of raw) {
                    const jid = p.id || p.jid || p.phoneNumber || '';
                    if (jid.endsWith('@lid') || jid.includes('@g.us'))
                        continue; // LID = linked device, não é número real
                    const phone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
                    if (!phone || phone.length < 8 || phone.includes('@'))
                        continue;
                    participants.push(phone);
                    if (p.admin === 'admin' || p.admin === 'superadmin')
                        admins.push(phone);
                }
                if (participants.length === 0)
                    continue;
                await database_1.default.whatsAppGroup.updateMany({
                    where: { instanceId, groupId: g.groupId },
                    data: { participantsCount: participants.length, participantsList: { participants, admins }, participantsSyncedAt: new Date() },
                }).catch(() => { });
                synced++;
            }
            catch { /* grupo falhou, continua */ }
            // Pequeno delay para não sobrecarregar a Evolution
            await new Promise(r => setTimeout(r, 200));
        }
        logger_1.default.info(`[SyncParticipants] Concluído: ${synced}/${groups.length} grupos sincronizados para ${instanceName}`);
    })();
});
exports.default = router;
//# sourceMappingURL=group.routes.js.map