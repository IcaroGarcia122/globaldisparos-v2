import prisma from '../config/database';
import whatsappService from './whatsapp.service';
import { cache } from '../config/redis';
import logger from '../utils/logger';

const CACHE_TTL = 5 * 60; // 5 min
const syncRunning = new Set<string>();
const syncProgress = new Map<string, string>();

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

  const instName = `instance_${instanceId}`;
  logger.info(`[Groups] Sync iniciado para ${instName}`);

  try {
    if (delayMs > 0) {
      syncProgress.set(key, `aguardando ${delayMs/1000}s...`);
      await new Promise(r => setTimeout(r, delayMs));
    }

    // Verifica se já temos grupos no banco (vindos via webhook)
    const existing = await prisma.whatsAppGroup.count({ where: { instanceId } });
    if (existing > 0) {
      logger.info(`[Groups] ${existing} grupos já no banco para ${instName} — invalidando cache`);
      await cache.del(`groups:${instanceId}`);
      return;
    }

    // Estratégia: findChats → JIDs dos grupos → findGroupInfos por lote
    syncProgress.set(key, 'extraindo grupos via findChats...');
    logger.info(`[Groups] Iniciando sync via findChats+findGroupInfos para ${instName}`);

    const raw = await whatsappService.fetchGroups(instName);
    if (raw.length > 0) {
      syncProgress.set(key, `salvando ${raw.length} grupos...`);
      const saved = await saveGroupsFromWebhook(instanceId, raw);
      logger.info(`[Groups] ✅ ${saved} grupos salvos para ${instName}`);

      // Enriquece nomes em background: primeiro via mensagens (rápido), depois findGroupInfos (fallback)
      logger.info(`[Groups] Iniciando enriquecimento de nomes em background...`);
      whatsappService.enrichGroupNamesViaMessages(instName, instanceId, prisma)
        .then(async () => {
          await cache.del(`groups:${instanceId}`);
          return whatsappService.enrichGroupNames(instName, instanceId, prisma);
        })
        .then(() => cache.del(`groups:${instanceId}`))
        .catch((e: any) =>
          logger.warn(`[Groups] enrichGroupNames erro: ${e.message}`)
      );
      return;
    }

    logger.warn(`[Groups] Nenhum grupo encontrado para ${instName}`);

  } catch (err: any) {
    logger.error(`[Groups] Sync erro: ${err.message}`);
  } finally {
    syncRunning.delete(key);
    syncProgress.delete(key);
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
  const instanceName = `instance_${instanceId}`;
  const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 horas — reusa cache se Evolution estiver offline

  // ── 1. Tentar buscar da Evolution (fonte mais atualizada) ──────────────────
  logger.info(`[Groups] Buscando participantes da Evolution: ${groupJid}`);
  const raw = await whatsappService.getGroupParticipants(instanceName, groupJid);

  if (raw.length > 0) {
    const { participants, admins } = parseRawParticipants(raw);

    if (participants.length > 0) {
      // Salvar no banco como cache persistente
      await prisma.whatsAppGroup.updateMany({
        where: { instanceId, groupId: groupJid },
        data: {
          participantsCount: participants.length,
          participantsList: { participants, admins } as any,
          participantsSyncedAt: new Date(),
        },
      }).catch(() => {});
      logger.info(`[Groups] ${participants.length} participantes salvos no banco para ${groupJid}`);
      return { participants, admins, total: participants.length, source: 'evolution' };
    }
  }

  // ── 2. Fallback: banco de dados (cache persistente) ────────────────────────
  logger.warn(`[Groups] Evolution falhou — tentando banco de dados para ${groupJid}`);
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
    return {
      participants: cached.participants as string[],
      admins: (cached.admins || []) as string[],
      total: cached.participants.length,
      source: isStale ? 'db_stale' : 'db_cache',
      cachedAt: row?.participantsSyncedAt,
    };
  }

  // ── 3. Sem dados em lugar algum ────────────────────────────────────────────
  logger.warn(`[Groups] Nenhum participante encontrado para ${groupJid} (Evolution offline, sem cache no banco)`);
  logger.warn(`[Groups] DICA: Acesse a aba Grupos → Sincronizar para popular o cache quando a Evolution estiver online`);
  return { participants: [], admins: [], total: 0, source: 'none' };
}