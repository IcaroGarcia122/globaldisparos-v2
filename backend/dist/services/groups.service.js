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
exports.saveGroupsFromWebhook = saveGroupsFromWebhook;
exports.getGroups = getGroups;
exports.syncGroupsBackground = syncGroupsBackground;
exports.syncAllParticipants = syncAllParticipants;
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
const participantSyncRunning = new Set();
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
        const inst = await database_1.default.whatsAppInstance.findUnique({ where: { id: instanceId }, select: { status: true } });
        if (inst?.status !== 'connected') {
            // Instância offline — retorna o que tem no banco sem chamar Evolution
            logger_1.default.info(`[Groups] Instância ${instName} offline — usando banco sem sync`);
            await redis_1.cache.del(`groups:${instanceId}`);
            return;
        }
        // Instância conectada — sempre busca da Evolution para pegar grupos novos
        await redis_1.cache.del(`groups:${instanceId}`);
        syncProgress.set(key, 'buscando grupos na Evolution...');
        logger_1.default.info(`[Groups] Sync via Evolution para ${instName}`);
        const raw = await whatsapp_service_1.default.fetchGroups(instName);
        if (raw.length > 0) {
            syncProgress.set(key, `salvando ${raw.length} grupos...`);
            const saved = await saveGroupsFromWebhook(instanceId, raw);
            await redis_1.cache.del(`groups:${instanceId}`);
            logger_1.default.info(`[Groups] ✅ ${saved} grupos salvos para ${instName}`);
            // Sync participantes em background para popular admins
            syncAllParticipants(instanceId, instName).catch(() => { });
            // Enriquece nomes em background
            whatsapp_service_1.default.enrichGroupNamesViaMessages(instName, instanceId, database_1.default)
                .then(async () => {
                await redis_1.cache.del(`groups:${instanceId}`);
                return whatsapp_service_1.default.enrichGroupNames(instName, instanceId, database_1.default);
            })
                .then(() => redis_1.cache.del(`groups:${instanceId}`))
                .catch((e) => logger_1.default.warn(`[Groups] enrichGroupNames erro: ${e.message}`));
            return;
        }
        // Evolution não retornou grupos — usar banco (pode ter grupos de sessão anterior)
        const existing = await database_1.default.whatsAppGroup.count({ where: { instanceId } });
        if (existing > 0) {
            logger_1.default.info(`[Groups] Evolution sem dados — usando ${existing} grupos do banco para ${instName}`);
            await redis_1.cache.del(`groups:${instanceId}`);
            return;
        }
        logger_1.default.warn(`[Groups] Nenhum grupo — Evolution sem dados e banco vazio para ${instName}`);
    }
    catch (err) {
        logger_1.default.error(`[Groups] Sync erro: ${err.message}`);
    }
    finally {
        syncRunning.delete(key);
        syncProgress.delete(key);
    }
}
/**
 * Sincroniza participantes de todos os grupos via UMA única chamada fetchAllGroups?getParticipants=true.
 * Muito mais rápido que chamar grupo por grupo.
 */
async function syncAllParticipants(instanceId, instanceName) {
    const key = String(instanceId);
    if (participantSyncRunning.has(key))
        return;
    participantSyncRunning.add(key);
    try {
        logger_1.default.info(`[Groups] Sync participantes (bulk) para ${instanceName}`);
        // Uma única chamada para todos os grupos com participantes
        const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
        const baseURL = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081').replace('localhost', '127.0.0.1');
        const apiKey = process.env.EVOLUTION_API_KEY || '';
        const res = await axios.get(`${baseURL}/group/fetchAllGroups/${instanceName}?getParticipants=true`, { headers: { apikey: apiKey }, timeout: 120000 });
        const raw = Array.isArray(res.data) ? res.data : (res.data?.groups || res.data?.value || []);
        const withParticipants = raw.filter((g) => (g.id || g.jid || '').includes('@g.us') && Array.isArray(g.participants) && g.participants.length > 0);
        logger_1.default.info(`[Groups] ${withParticipants.length} grupos com participantes recebidos da Evolution`);
        let synced = 0;
        for (const g of withParticipants) {
            const gid = g.id || g.jid;
            const participants = [];
            const admins = [];
            for (const p of g.participants) {
                const jid = p.id || p.jid || p.phoneNumber || '';
                const phone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
                if (!phone || phone.length < 8)
                    continue;
                participants.push(phone);
                if (p.admin === 'admin' || p.admin === 'superadmin' || p.isAdmin)
                    admins.push(phone);
            }
            if (!participants.length)
                continue;
            await database_1.default.whatsAppGroup.updateMany({
                where: { instanceId, groupId: gid },
                data: { participantsList: { participants, admins }, participantsCount: participants.length, participantsSyncedAt: new Date() },
            }).catch(() => { });
            synced++;
        }
        logger_1.default.info(`[Groups] ✅ Sync participantes concluído: ${synced} grupos atualizados para ${instanceName}`);
    }
    catch (err) {
        logger_1.default.warn(`[Groups] Sync participantes erro: ${err.message}`);
    }
    finally {
        participantSyncRunning.delete(key);
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
        // Filtrar LIDs (>=14 dígitos) e números inválidos do cache
        const filteredParticipants = cached.participants.filter((p) => {
            const digits = p.replace(/\D/g, '');
            return digits.length >= 10 && digits.length <= 13; // números reais BR: 12-13 dígitos com 55
        });
        logger_1.default.info(`[Groups] Filtrado: ${cached.participants.length} → ${filteredParticipants.length} (removidos ${cached.participants.length - filteredParticipants.length} LIDs)`);
        return {
            participants: filteredParticipants,
            admins: (cached.admins || []),
            total: filteredParticipants.length,
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