"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveGroupsFromWebhook = saveGroupsFromWebhook;
exports.getGroups = getGroups;
exports.syncGroupsBackground = syncGroupsBackground;
exports.isSyncing = isSyncing;
exports.getSyncProgress = getSyncProgress;
exports.getParticipants = getParticipants;
const database_1 = __importDefault(require("../config/database"));
const whatsapp_service_1 = __importDefault(require("./whatsapp.service"));
const redis_1 = require("../config/redis");
const logger_1 = __importDefault(require("../utils/logger"));
const CACHE_TTL = 5 * 60; // 5 min
const syncRunning = new Set();
const syncProgress = new Map();
// ─── SALVAR GRUPOS (chamado pelo webhook GROUPS_UPSERT) ───────────────────────
async function saveGroupsFromWebhook(instanceId, rawGroups) {
    if (!rawGroups?.length)
        return 0;
    const groups = rawGroups
        .filter((g) => (g.id || g.jid || '').includes('@g.us'))
        .map((g) => ({
        instanceId,
        groupId: g.id || g.jid,
        name: (g.subject || g.name || 'Grupo sem nome').trim(),
        participantsCount: g.size || g.participants?.length || 0,
        extractedAt: new Date(),
    }));
    if (!groups.length)
        return 0;
    let saved = 0;
    for (const g of groups) {
        try {
            // Se o payload veio com participantes (GROUPS_UPSERT completo), salva a lista também
            const rawGroup = rawGroups.find((r) => (r.id || r.jid) === g.groupId);
            const rawParticipants = rawGroup?.participants || [];
            let participantsList = undefined;
            if (rawParticipants.length > 0) {
                const participants = [];
                const admins = [];
                for (const p of rawParticipants) {
                    const jid = p.phoneNumber || p.id || p.jid || '';
                    const phone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
                    if (!phone || phone.length < 8 || phone.includes('@') || jid.endsWith('@lid'))
                        continue;
                    participants.push(phone);
                    if (p.admin === 'admin' || p.admin === 'superadmin')
                        admins.push(phone);
                }
                if (participants.length > 0) {
                    participantsList = { participants, admins };
                    g.participantsCount = participants.length;
                }
            }
            await database_1.default.whatsAppGroup.upsert({
                where: { instanceId_groupId: { instanceId: g.instanceId, groupId: g.groupId } },
                update: {
                    name: g.name,
                    participantsCount: g.participantsCount,
                    extractedAt: g.extractedAt,
                    ...(participantsList ? { participantsList, participantsSyncedAt: new Date() } : {}),
                },
                create: {
                    ...g,
                    ...(participantsList ? { participantsList, participantsSyncedAt: new Date() } : {}),
                },
            });
            saved++;
        }
        catch { /* ignora duplicatas */ }
    }
    if (saved > 0)
        await redis_1.cache.del(`groups:${instanceId}`);
    logger_1.default.info(`[Groups] ${saved}/${groups.length} grupos salvos via webhook (instância ${instanceId})`);
    return saved;
}
// ─── BUSCAR GRUPOS DO BANCO ───────────────────────────────────────────────────
async function getGroups(instanceId) {
    const cacheKey = `groups:${instanceId}`;
    const cached = await redis_1.cache.get(cacheKey);
    if (cached)
        return { groups: cached, source: 'cache' };
    const rows = await database_1.default.whatsAppGroup.findMany({
        where: { instanceId },
        orderBy: { name: 'asc' },
    });
    if (rows.length > 0) {
        const groups = rows.map(r => ({
            id: r.groupId,
            name: r.name,
            participantsCount: r.participantsCount,
        }));
        await redis_1.cache.set(cacheKey, groups, CACHE_TTL);
        return { groups, source: 'db' };
    }
    return { groups: [], source: 'empty' };
}
// ─── SYNC VIA WEBHOOK (método principal) ─────────────────────────────────────
// A Evolution emite GROUPS_UPSERT automaticamente quando a instância conecta
// com sync_full_history: true. Se não vier, use syncGroupsBackground como fallback.
async function syncGroupsBackground(instanceId, delayMs = 0) {
    const key = String(instanceId);
    if (syncRunning.has(key)) {
        logger_1.default.info(`[Groups] Sync já em andamento para instância ${instanceId}`);
        return;
    }
    syncRunning.add(key);
    const instRow = await database_1.default.whatsAppInstance.findUnique({
        where: { id: instanceId }, select: { name: true }
    }).catch(() => null);
    const instName = instRow?.name || `instance_${instanceId}`;
    logger_1.default.info(`[Groups] Sync iniciado para ${instName} (id=${instanceId})`);
    try {
        if (delayMs > 0) {
            syncProgress.set(key, `aguardando ${delayMs / 1000}s...`);
            await new Promise(r => setTimeout(r, delayMs));
        }
        // Se já temos grupos no banco E a instância está conectada, apenas limpar cache
        const existing = await database_1.default.whatsAppGroup.count({ where: { instanceId } });
        const inst = await database_1.default.whatsAppInstance.findUnique({ where: { id: instanceId }, select: { status: true } });
        if (existing > 0 && inst?.status !== 'connected') {
            // Instância desconectada com grupos no banco — retornar cache sem tentar Evolution
            logger_1.default.info(`[Groups] ${existing} grupos no banco (instância offline) — usando cache para ${instName}`);
            await redis_1.cache.del(`groups:${instanceId}`);
            return;
        }
        if (existing > 0 && inst?.status === 'connected') {
            // Instância conectada com grupos — verificar se precisa re-sync
            logger_1.default.info(`[Groups] ${existing} grupos no banco para ${instName} — invalidando cache`);
            await redis_1.cache.del(`groups:${instanceId}`);
            // Continuar para tentar atualizar via Evolution
        }
        // Estratégia: findChats → JIDs dos grupos → findGroupInfos por lote
        syncProgress.set(key, 'extraindo grupos via findChats...');
        logger_1.default.info(`[Groups] Iniciando sync via findChats+findGroupInfos para ${instName}`);
        const raw = await whatsapp_service_1.default.fetchGroups(instName);
        if (raw.length > 0) {
            syncProgress.set(key, `salvando ${raw.length} grupos...`);
            const saved = await saveGroupsFromWebhook(instanceId, raw);
            logger_1.default.info(`[Groups] ✅ ${saved} grupos salvos para ${instName}`);
            whatsapp_service_1.default.enrichGroupNamesViaMessages(instName, instanceId, database_1.default)
                .then(async () => {
                await redis_1.cache.del(`groups:${instanceId}`);
                return whatsapp_service_1.default.enrichGroupNames(instName, instanceId, database_1.default);
            })
                .then(() => redis_1.cache.del(`groups:${instanceId}`))
                .catch((e) => logger_1.default.warn(`[Groups] enrichGroupNames erro: ${e.message}`));
            return;
        }
        // Evolution sem grupos (sessão perdida ou offline)
        // Verificar se temos grupos no banco de uma sessão anterior
        const cached = await database_1.default.whatsAppGroup.count({ where: { instanceId } });
        if (cached > 0) {
            logger_1.default.info(`[Groups] Evolution sem dados — usando ${cached} grupos em cache do banco para ${instName}`);
            await redis_1.cache.del(`groups:${instanceId}`);
            return;
        }
        logger_1.default.warn(`[Groups] Nenhum grupo — Evolution offline e banco vazio para ${instName}. Reconecte o WhatsApp.`);
    }
    catch (err) {
        logger_1.default.error(`[Groups] Sync erro: ${err.message}`);
    }
    finally {
        syncRunning.delete(key);
        syncProgress.delete(key);
    }
}
function isSyncing(instanceId) {
    return syncRunning.has(String(instanceId));
}
function getSyncProgress(instanceId) {
    return syncProgress.get(String(instanceId)) || null;
}
// ─── PARTICIPANTES ────────────────────────────────────────────────────────────
function parseRawParticipants(raw) {
    const participants = [];
    const admins = [];
    for (const p of raw) {
        const jid = p.phoneNumber || p.id || p.jid || '';
        const phone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
        if (!phone || phone.length < 8 || phone.includes('@') || jid.endsWith('@lid'))
            continue;
        participants.push(phone);
        if (p.admin === 'admin' || p.admin === 'superadmin' || p.isAdmin)
            admins.push(phone);
    }
    return { participants, admins };
}
async function getParticipants(instanceId, groupJid) {
    // Buscar nome real da instância no banco
    const instanceRow = await database_1.default.whatsAppInstance.findUnique({
        where: { id: instanceId }, select: { name: true }
    }).catch(() => null);
    const instanceName = instanceRow?.name || `instance_${instanceId}`;
    const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
    // ── 1. Banco primeiro (evita timeout da Evolution v2.3.6) ─────────────────
    // fetchAllGroups?getParticipants=true causa timeout de 60s nesta versão
    // Só tenta Evolution se o banco estiver vazio
    const row = await database_1.default.whatsAppGroup.findFirst({
        where: { instanceId, groupId: groupJid },
        select: { participantsList: true, participantsSyncedAt: true, participantsCount: true },
    }).catch(() => null);
    const cached = row?.participantsList;
    if (cached?.participants?.length > 0) {
        const age = row?.participantsSyncedAt
            ? Date.now() - new Date(row.participantsSyncedAt).getTime()
            : Infinity;
        const ageHours = Math.round(age / 3600000);
        const isStale = age > CACHE_MAX_AGE_MS;
        logger_1.default.info(`[Groups] ${cached.participants.length} participantes do banco (${isStale ? 'desatualizado' : `atualizado há ${ageHours}h`}) para ${groupJid}`);
        return {
            participants: cached.participants,
            admins: (cached.admins || []),
            total: cached.participants.length,
            source: isStale ? 'db_stale' : 'db_cache',
            cachedAt: row?.participantsSyncedAt,
        };
    }
    // ── 2. Banco vazio → tentar Evolution como último recurso ────────────────
    logger_1.default.info(`[Groups] Banco vazio para ${groupJid} — tentando Evolution`);
    try {
        const raw = await whatsapp_service_1.default.getGroupParticipants(instanceName, groupJid);
        if (raw.length > 0) {
            const { participants, admins } = parseRawParticipants(raw);
            if (participants.length > 0) {
                await database_1.default.whatsAppGroup.updateMany({
                    where: { instanceId, groupId: groupJid },
                    data: {
                        participantsCount: participants.length,
                        participantsList: { participants, admins },
                        participantsSyncedAt: new Date(),
                    },
                }).catch(() => { });
                logger_1.default.info(`[Groups] ${participants.length} participantes da Evolution salvos no banco`);
                return { participants, admins, total: participants.length, source: 'evolution' };
            }
        }
    }
    catch (err) {
        logger_1.default.warn(`[Groups] Evolution falhou: ${err.message}`);
    }
    // ── 3. Sem dados — orientar a sincronizar ──────────────────────────────────
    logger_1.default.warn(`[Groups] Sem participantes para ${groupJid} — acesse Grupos → Sincronizar`);
    return { participants: [], admins: [], total: 0, source: 'none' };
}
//# sourceMappingURL=groups.service.js.map