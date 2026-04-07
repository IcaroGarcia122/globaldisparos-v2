import prisma from '../config/database';
import whatsappService from './whatsapp.service';
import { cache } from '../config/redis';
import logger from '../utils/logger';

const CACHE_TTL = 5 * 60; // 5 min
const syncRunning = new Set<string>();
const syncProgress = new Map<string, string>();
const participantSyncRunning = new Set<string>();

// ─── SALVAR GRUPOS (chamado pelo webhook GROUPS_UPSERT) ───────────────────────
export async function saveGroupsFromWebhook(instanceId: number, rawGroups: any[]): Promise<number> {
  if (!rawGroups?.length) return 0;

  const groups = rawGroups
    .filter((g: any) => (g.id || g.jid || '').includes('@g.us'))
    .map((g: any) => ({
      instanceId,
      groupId: g.id || g.jid,
      name: (g.subject || g.name || 'Grupo sem nome').trim(),
      participantsCount: g.size || g.participants?.length || 0,
      extractedAt: new Date(),
    }));

  if (!groups.length) return 0;

  let saved = 0;
  for (const g of groups) {
    try {
      // Se o payload veio com participantes (GROUPS_UPSERT completo), salva a lista também
      const rawGroup = rawGroups.find((r: any) => (r.id || r.jid) === g.groupId);
      const rawParticipants: any[] = rawGroup?.participants || [];
      let participantsList: any = undefined;
      if (rawParticipants.length > 0) {
        const participants: string[] = [];
        const admins: string[] = [];
        for (const p of rawParticipants) {
          const jid: string = p.phoneNumber || p.id || p.jid || '';
          const phone = jid.replace('@s.whatsapp.net','').replace('@c.us','');
          if (!phone || phone.length < 8 || phone.includes('@') || jid.endsWith('@lid')) continue;
          participants.push(phone);
          if (p.admin === 'admin' || p.admin === 'superadmin') admins.push(phone);
        }
        if (participants.length > 0) {
          participantsList = { participants, admins };
          g.participantsCount = participants.length;
        }
      }

      await prisma.whatsAppGroup.upsert({
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
    } catch { /* ignora duplicatas */ }
  }

  if (saved > 0) await cache.del(`groups:${instanceId}`);
  logger.info(`[Groups] ${saved}/${groups.length} grupos salvos via webhook (instância ${instanceId})`);
  return saved;
}

// ─── BUSCAR GRUPOS DO BANCO ───────────────────────────────────────────────────
export async function getGroups(instanceId: number): Promise<{ groups: any[]; source: string }> {
  const cacheKey = `groups:${instanceId}`;

  const cached = await cache.get(cacheKey);
  if (cached) return { groups: cached, source: 'cache' };

  const rows = await prisma.whatsAppGroup.findMany({
    where: { instanceId },
    orderBy: { name: 'asc' },
  });

  if (rows.length > 0) {
    const groups = rows.map(r => ({
      id: r.groupId,
      name: r.name,
      participantsCount: r.participantsCount,
    }));
    await cache.set(cacheKey, groups, CACHE_TTL);
    return { groups, source: 'db' };
  }

  return { groups: [], source: 'empty' };
}

// ─── SYNC VIA WEBHOOK (método principal) ─────────────────────────────────────
// A Evolution emite GROUPS_UPSERT automaticamente quando a instância conecta
// com sync_full_history: true. Se não vier, use syncGroupsBackground como fallback.

export async function syncGroupsBackground(instanceId: number, delayMs = 0): Promise<void> {
  const key = String(instanceId);
  if (syncRunning.has(key)) {
    logger.info(`[Groups] Sync já em andamento para instância ${instanceId}`);
    return;
  }
  syncRunning.add(key);

  const instRow = await prisma.whatsAppInstance.findUnique({
    where: { id: instanceId }, select: { name: true }
  }).catch(() => null);
  const instName = instRow?.name || `instance_${instanceId}`;
  logger.info(`[Groups] Sync iniciado para ${instName} (id=${instanceId})`);

  try {
    if (delayMs > 0) {
      syncProgress.set(key, `aguardando ${delayMs/1000}s...`);
      await new Promise(r => setTimeout(r, delayMs));
    }

    const inst = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId }, select: { status: true } });

    if (inst?.status !== 'connected') {
      // Instância offline — retorna o que tem no banco sem chamar Evolution
      logger.info(`[Groups] Instância ${instName} offline — usando banco sem sync`);
      await cache.del(`groups:${instanceId}`);
      return;
    }

    // Instância conectada — sempre busca da Evolution para pegar grupos novos
    await cache.del(`groups:${instanceId}`);
    syncProgress.set(key, 'buscando grupos na Evolution...');
    logger.info(`[Groups] Sync via Evolution para ${instName}`);

    const raw = await whatsappService.fetchGroups(instName);
    if (raw.length > 0) {
      syncProgress.set(key, `salvando ${raw.length} grupos...`);
      const saved = await saveGroupsFromWebhook(instanceId, raw);
      await cache.del(`groups:${instanceId}`);
      logger.info(`[Groups] ✅ ${saved} grupos salvos para ${instName}`);
      // Sync participantes em background para popular admins
      syncAllParticipants(instanceId, instName).catch(() => {});
      // Enriquece nomes em background
      whatsappService.enrichGroupNamesViaMessages(instName, instanceId, prisma)
        .then(async () => {
          await cache.del(`groups:${instanceId}`);
          return whatsappService.enrichGroupNames(instName, instanceId, prisma);
        })
        .then(() => cache.del(`groups:${instanceId}`))
        .catch((e: any) => logger.warn(`[Groups] enrichGroupNames erro: ${e.message}`));
      return;
    }

    // Evolution não retornou grupos — usar banco (pode ter grupos de sessão anterior)
    const existing = await prisma.whatsAppGroup.count({ where: { instanceId } });
    if (existing > 0) {
      logger.info(`[Groups] Evolution sem dados — usando ${existing} grupos do banco para ${instName}`);
      await cache.del(`groups:${instanceId}`);
      return;
    }

    logger.warn(`[Groups] Nenhum grupo — Evolution sem dados e banco vazio para ${instName}`);

  } catch (err: any) {
    logger.error(`[Groups] Sync erro: ${err.message}`);
  } finally {
    syncRunning.delete(key);
    syncProgress.delete(key);
  }
}

/**
 * Sincroniza participantes de todos os grupos via UMA única chamada fetchAllGroups?getParticipants=true.
 * Muito mais rápido que chamar grupo por grupo.
 */
export async function syncAllParticipants(instanceId: number, instanceName: string): Promise<void> {
  const key = String(instanceId);
  if (participantSyncRunning.has(key)) return;
  participantSyncRunning.add(key);

  try {
    logger.info(`[Groups] Sync participantes (bulk) para ${instanceName}`);

    // Uma única chamada para todos os grupos com participantes
    const axios = (await import('axios')).default;
    const baseURL = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081').replace('localhost', '127.0.0.1');
    const apiKey  = process.env.EVOLUTION_API_KEY || '';

    const res = await axios.get(
      `${baseURL}/group/fetchAllGroups/${instanceName}?getParticipants=true`,
      { headers: { apikey: apiKey }, timeout: 120000 }
    );

    const raw = Array.isArray(res.data) ? res.data : (res.data?.groups || res.data?.value || []);
    const withParticipants = raw.filter((g: any) =>
      (g.id || g.jid || '').includes('@g.us') && Array.isArray(g.participants) && g.participants.length > 0
    );

    logger.info(`[Groups] ${withParticipants.length} grupos com participantes recebidos da Evolution`);

    let synced = 0;
    for (const g of withParticipants) {
      const gid: string = g.id || g.jid;
      const participants: string[] = [];
      const admins: string[] = [];

      for (const p of g.participants) {
        const jid: string = p.id || p.jid || p.phoneNumber || '';
        const phone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
        if (!phone || phone.length < 8) continue;
        participants.push(phone);
        if (p.admin === 'admin' || p.admin === 'superadmin' || p.isAdmin) admins.push(phone);
      }
      if (!participants.length) continue;

      await prisma.whatsAppGroup.updateMany({
        where: { instanceId, groupId: gid },
        data: { participantsList: { participants, admins } as any, participantsCount: participants.length, participantsSyncedAt: new Date() },
      }).catch(() => {});
      synced++;
    }
    logger.info(`[Groups] ✅ Sync participantes concluído: ${synced} grupos atualizados para ${instanceName}`);
  } catch (err: any) {
    logger.warn(`[Groups] Sync participantes erro: ${err.message}`);
  } finally {
    participantSyncRunning.delete(key);
  }
}

export function isSyncing(instanceId: number): boolean {
  return syncRunning.has(String(instanceId));
}

export function getSyncProgress(instanceId: number): string | null {
  return syncProgress.get(String(instanceId)) || null;
}

// ─── PARTICIPANTES ────────────────────────────────────────────────────────────

function parseRawParticipants(raw: any[]): { participants: string[]; admins: string[] } {
  const participants: string[] = [];
  const admins: string[] = [];
  for (const p of raw) {
    const jid: string = p.phoneNumber || p.id || p.jid || '';
    const phone = jid.replace('@s.whatsapp.net','').replace('@c.us','');
    if (!phone || phone.length < 8 || phone.includes('@') || jid.endsWith('@lid')) continue;
    participants.push(phone);
    if (p.admin === 'admin' || p.admin === 'superadmin' || p.isAdmin) admins.push(phone);
  }
  return { participants, admins };
}

export async function getParticipants(instanceId: number, groupJid: string) {
  // Buscar nome real da instância no banco
  const instanceRow = await prisma.whatsAppInstance.findUnique({
    where: { id: instanceId }, select: { name: true }
  }).catch(() => null);
  const instanceName = instanceRow?.name || `instance_${instanceId}`;
  const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

  // ── 1. Banco primeiro (evita timeout da Evolution v2.3.6) ─────────────────
  // fetchAllGroups?getParticipants=true causa timeout de 60s nesta versão
  // Só tenta Evolution se o banco estiver vazio
  const row = await prisma.whatsAppGroup.findFirst({
    where: { instanceId, groupId: groupJid },
    select: { participantsList: true, participantsSyncedAt: true, participantsCount: true },
  }).catch(() => null);

  const cached = row?.participantsList as any;
  if (cached?.participants?.length > 0) {
    const age = row?.participantsSyncedAt
      ? Date.now() - new Date(row.participantsSyncedAt).getTime()
      : Infinity;
    const ageHours = Math.round(age / 3600000);
    const isStale = age > CACHE_MAX_AGE_MS;

    logger.info(`[Groups] ${cached.participants.length} participantes do banco (${isStale ? 'desatualizado' : `atualizado há ${ageHours}h`}) para ${groupJid}`);
    // Filtrar LIDs (>=14 dígitos) e números inválidos do cache
    const filteredParticipants = (cached.participants as string[]).filter((p: string) => {
      const digits = p.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 13; // números reais BR: 12-13 dígitos com 55
    });
    logger.info(`[Groups] Filtrado: ${cached.participants.length} → ${filteredParticipants.length} (removidos ${cached.participants.length - filteredParticipants.length} LIDs)`);
    return {
      participants: filteredParticipants,
      admins: (cached.admins || []) as string[],
      total: filteredParticipants.length,
      source: isStale ? 'db_stale' : 'db_cache',
      cachedAt: row?.participantsSyncedAt,
    };
  }

  // ── 2. Banco vazio → tentar Evolution como último recurso ────────────────
  logger.info(`[Groups] Banco vazio para ${groupJid} — tentando Evolution`);
  try {
    const raw = await whatsappService.getGroupParticipants(instanceName, groupJid);
    if (raw.length > 0) {
      const { participants, admins } = parseRawParticipants(raw);
      if (participants.length > 0) {
        await prisma.whatsAppGroup.updateMany({
          where: { instanceId, groupId: groupJid },
          data: {
            participantsCount: participants.length,
            participantsList: { participants, admins } as any,
            participantsSyncedAt: new Date(),
          },
        }).catch(() => {});
        logger.info(`[Groups] ${participants.length} participantes da Evolution salvos no banco`);
        return { participants, admins, total: participants.length, source: 'evolution' };
      }
    }
  } catch (err: any) {
    logger.warn(`[Groups] Evolution falhou: ${err.message}`);
  }

  // ── 3. Sem dados — orientar a sincronizar ──────────────────────────────────
  logger.warn(`[Groups] Sem participantes para ${groupJid} — acesse Grupos → Sincronizar`);
  return { participants: [], admins: [], total: 0, source: 'none' };
}