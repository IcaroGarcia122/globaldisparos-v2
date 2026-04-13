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
// ─── NORMALIZAÇÃO DE NÚMERO ──────────────────────────────────────────────────
/**
 * Valida e normaliza número de telefone.
 * Rejeita: LIDs (≥14 dígitos), números curtos (<8 dígitos), @lid
 * Normaliza brasileiros para 55XXXXXXXXXXX (13 dígitos)
 * Aceita outros números internacionais como estão (8-13 dígitos)
 */
function normalizeBrPhone(raw) {
    let d = raw.replace(/\D/g, '');
    // Rejeita vazio, muito curto ou LID (≥14 dígitos — IDs internos do WhatsApp/Meta)
    if (!d || d.length < 8 || d.length >= 14)
        return null;
    // Normaliza número brasileiro com código 55 (12-13 dígitos)
    if (d.startsWith('55') && d.length >= 12 && d.length <= 13) {
        const sem55 = d.slice(2);
        if (sem55.length === 10)
            return '55' + sem55.slice(0, 2) + '9' + sem55.slice(2);
        if (sem55.length === 11)
            return '55' + sem55;
    }
    // Normaliza número brasileiro sem código 55 (10-11 dígitos)
    if (d.length === 10)
        return '55' + d.slice(0, 2) + '9' + d.slice(2);
    if (d.length === 11)
        return '55' + d;
    // Outros comprimentos válidos (8-9 ou 12-13 não-BR): retorna como está
    return d;
}
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
            const rawGroup = rawGroups.find((r) => (r.id || r.jid) === g.groupId);
            const rawParticipants = rawGroup?.participants || [];
            let participantsList = undefined;
            if (rawParticipants.length > 0) {
                const participants = [];
                const admins = [];
                for (const p of rawParticipants) {
                    // Prioriza p.phoneNumber (número explícito) antes do JID
                    const jid = p.phoneNumber || p.id || p.jid || '';
                    if (jid.endsWith('@lid') || jid.includes('@g.us'))
                        continue;
                    const phone = normalizeBrPhone(jid.replace('@s.whatsapp.net', '').replace('@c.us', ''));
                    if (!phone)
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
            logger_1.default.info(`[Groups] Instância ${instName} offline — usando banco sem sync`);
            await redis_1.cache.del(`groups:${instanceId}`);
            return;
        }
        await redis_1.cache.del(`groups:${instanceId}`);
        syncProgress.set(key, 'buscando grupos na Evolution...');
        logger_1.default.info(`[Groups] Sync via Evolution para ${instName}`);
        const raw = await whatsapp_service_1.default.fetchGroups(instName);
        if (raw.length > 0) {
            syncProgress.set(key, `salvando ${raw.length} grupos...`);
            const saved = await saveGroupsFromWebhook(instanceId, raw);
            await redis_1.cache.del(`groups:${instanceId}`);
            logger_1.default.info(`[Groups] ✅ ${saved} grupos salvos para ${instName}`);
            syncAllParticipants(instanceId, instName).catch(() => { });
            whatsapp_service_1.default.enrichGroupNamesViaMessages(instName, instanceId, database_1.default)
                .then(async () => {
                await redis_1.cache.del(`groups:${instanceId}`);
                return whatsapp_service_1.default.enrichGroupNames(instName, instanceId, database_1.default);
            })
                .then(() => redis_1.cache.del(`groups:${instanceId}`))
                .catch((e) => logger_1.default.warn(`[Groups] enrichGroupNames erro: ${e.message}`));
            return;
        }
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
 * Sincroniza participantes de todos os grupos via fetchAllGroups?getParticipants=true.
 * Prioriza p.phoneNumber (campo explícito) antes do JID — Evolution v2 pode retornar
 * @lid como p.id mas ainda incluir o número real em p.phoneNumber.
 * Ignora grupos cujo bulk retornou muito menos participantes do que o tamanho esperado
 * (indica que a maioria era @lid) para não sobrescrever dados bons com dados degradados.
 */
async function syncAllParticipants(instanceId, instanceName) {
    const key = String(instanceId);
    if (participantSyncRunning.has(key))
        return;
    participantSyncRunning.add(key);
    try {
        logger_1.default.info(`[Groups] Sync participantes (bulk) para ${instanceName}`);
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
                // IMPORTANTE: prioriza p.phoneNumber antes do JID (p.id pode ser @lid)
                const jid = p.phoneNumber || p.id || p.jid || '';
                if (jid.endsWith('@lid') || jid.includes('@g.us'))
                    continue;
                const phone = normalizeBrPhone(jid.replace('@s.whatsapp.net', '').replace('@c.us', ''));
                if (!phone)
                    continue;
                participants.push(phone);
                if (p.admin === 'admin' || p.admin === 'superadmin' || p.isAdmin)
                    admins.push(phone);
            }
            if (!participants.length)
                continue;
            // Não sobrescreve se o bulk retornou muito menos do que o tamanho real do grupo.
            // Isso indica que a maioria era @lid sem phoneNumber — dados degradados.
            const expectedSize = g.size || g.participants.length;
            if (expectedSize > 30 && participants.length < expectedSize * 0.25) {
                logger_1.default.info(`[Groups] ${gid}: bulk degradado (${participants.length}/${expectedSize} válidos) — mantendo DB`);
                continue;
            }
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
        // Prioriza p.phoneNumber antes do JID
        const jid = p.phoneNumber || p.id || p.jid || '';
        if (jid.endsWith('@lid') || jid.includes('@g.us'))
            continue;
        const phone = normalizeBrPhone(jid.replace('@s.whatsapp.net', '').replace('@c.us', ''));
        if (!phone)
            continue;
        participants.push(phone);
        if (p.admin === 'admin' || p.admin === 'superadmin' || p.isAdmin)
            admins.push(phone);
    }
    return { participants, admins };
}
/**
 * Busca participantes de um grupo.
 * ESTRATÉGIA: sempre tenta Evolution primeiro (dados frescos e corretos),
 * só usa banco como fallback se Evolution falhar/timeout.
 * Isso evita retornar dados sujos/desatualizados do cache.
 */
async function getParticipants(instanceId, groupJid) {
    const instanceRow = await database_1.default.whatsAppInstance.findUnique({
        where: { id: instanceId }, select: { name: true }
    }).catch(() => null);
    const instanceName = instanceRow?.name || `instance_${instanceId}`;
    // ── 1. Evolution em tempo real (fonte de verdade) ─────────────────────────
    try {
        const raw = await whatsapp_service_1.default.getGroupParticipants(instanceName, groupJid);
        if (raw.length > 0) {
            const { participants, admins } = parseRawParticipants(raw);
            if (participants.length > 0) {
                // Salva no banco em background (não bloqueia a resposta)
                database_1.default.whatsAppGroup.updateMany({
                    where: { instanceId, groupId: groupJid },
                    data: {
                        participantsCount: participants.length,
                        participantsList: { participants, admins },
                        participantsSyncedAt: new Date(),
                    },
                }).catch(() => { });
                logger_1.default.info(`[Groups] ✅ ${participants.length} participantes da Evolution para ${groupJid}`);
                return { participants, admins, total: participants.length, source: 'evolution' };
            }
            logger_1.default.warn(`[Groups] Evolution retornou ${raw.length} itens mas 0 números BR válidos para ${groupJid}`);
        }
    }
    catch (err) {
        logger_1.default.warn(`[Groups] Evolution falhou para ${groupJid}: ${err.message}`);
    }
    // ── 2. Fallback: banco de dados (caso Evolution falhe/timeout) ─────────────
    const row = await database_1.default.whatsAppGroup.findFirst({
        where: { instanceId, groupId: groupJid },
        select: { participantsList: true, participantsSyncedAt: true, participantsCount: true },
    }).catch(() => null);
    const cached = row?.participantsList;
    if (cached?.participants?.length > 0) {
        // Reprocessa os números do banco pelo normalizeBrPhone para limpar dados sujos
        const participants = [];
        const admins = [];
        for (const p of cached.participants) {
            const phone = normalizeBrPhone(p);
            if (phone)
                participants.push(phone);
        }
        for (const a of (cached.admins || [])) {
            const phone = normalizeBrPhone(a);
            if (phone)
                admins.push(phone);
        }
        if (participants.length > 0) {
            logger_1.default.info(`[Groups] ${participants.length} participantes do banco (fallback) para ${groupJid}`);
            return { participants, admins, total: participants.length, source: 'db_cache' };
        }
    }
    logger_1.default.warn(`[Groups] Sem participantes para ${groupJid} — nenhuma fonte disponível`);
    return { participants: [], admins: [], total: 0, source: 'none' };
}
//# sourceMappingURL=groups.service.js.map