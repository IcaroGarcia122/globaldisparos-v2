import prisma from '../config/database';
import whatsappService from './whatsapp.service';
import { cache } from '../config/redis';
import logger from '../utils/logger';

const CACHE_TTL = 5 * 60; // 5 min
const syncRunning = new Set<string>();
const syncProgress = new Map<string, string>();
const participantSyncRunning = new Set<string>();

// ─── NORMALIZAÇÃO DE NÚMERO ──────────────────────────────────────────────────
/**
 * Valida e normaliza número de telefone BRASILEIRO.
 * Aceita APENAS números do Brasil — rejeita LIDs, internacionais não-BR e curtos.
 *
 * Formatos aceitos:
 *   10 dígitos  → DDD + 8 dígitos (formato antigo sem 9): adiciona 55 e o 9
 *   11 dígitos  → DDD + 9 + 8 dígitos (formato atual): adiciona 55
 *   12 dígitos  → 55 + DDD + 8 dígitos (com código, sem 9): adiciona o 9
 *   13 dígitos  → 55 + DDD + 9 + 8 dígitos (formato completo) ✓
 *
 * Rejeita: tudo que não seja número BR válido (LIDs, internacionais, etc.)
 */
function normalizeBrPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');

  // Rejeita vazio ou LID (≥14 dígitos — IDs internos do WhatsApp/Meta)
  if (!d || d.length < 10 || d.length >= 14) return null;

  // Número com código 55 (12-13 dígitos) — deve começar com 55
  if (d.length === 13) {
    if (!d.startsWith('55')) return null; // rejeita 13 dígitos não-BR (ex: 3685232996379)
    return d; // 55 + DDD + 9XXXXXXXX ✓
  }
  if (d.length === 12) {
    if (!d.startsWith('55')) return null; // rejeita 12 dígitos não-BR
    // 55 + DDD + XXXXXXXX (sem 9) → adiciona 9
    const sem55 = d.slice(2); // 10 dígitos: DDD + 8
    return '55' + sem55.slice(0, 2) + '9' + sem55.slice(2);
  }

  // Número sem código 55 (10-11 dígitos) — considera sempre brasileiro
  if (d.length === 11) return '55' + d; // DDD + 9XXXXXXXX
  if (d.length === 10) return '55' + d.slice(0, 2) + '9' + d.slice(2); // DDD + XXXXXXXX → add 9

  return null;
}

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
      const rawGroup = rawGroups.find((r: any) => (r.id || r.jid) === g.groupId);
      const rawParticipants: any[] = rawGroup?.participants || [];
      let participantsList: any = undefined;
      if (rawParticipants.length > 0) {
        const participants: string[] = [];
        const admins: string[] = [];
        for (const p of rawParticipants) {
          // Prioriza p.phoneNumber (número explícito) antes do JID
          const jid: string = p.phoneNumber || p.id || p.jid || '';
          if (jid.endsWith('@lid') || jid.includes('@g.us')) continue;
          const phone = normalizeBrPhone(jid.replace('@s.whatsapp.net', '').replace('@c.us', ''));
          if (!phone) continue;
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
      logger.info(`[Groups] Instância ${instName} offline — usando banco sem sync`);
      await cache.del(`groups:${instanceId}`);
      return;
    }

    await cache.del(`groups:${instanceId}`);
    syncProgress.set(key, 'buscando grupos na Evolution...');
    logger.info(`[Groups] Sync via Evolution para ${instName}`);

    const raw = await whatsappService.fetchGroups(instName);
    if (raw.length > 0) {
      syncProgress.set(key, `salvando ${raw.length} grupos...`);
      const saved = await saveGroupsFromWebhook(instanceId, raw);
      await cache.del(`groups:${instanceId}`);
      logger.info(`[Groups] ✅ ${saved} grupos salvos para ${instName}`);
      syncAllParticipants(instanceId, instName).catch(() => {});
      whatsappService.enrichGroupNamesViaMessages(instName, instanceId, prisma)
        .then(async () => {
          await cache.del(`groups:${instanceId}`);
          return whatsappService.enrichGroupNames(instName, instanceId, prisma);
        })
        .then(() => cache.del(`groups:${instanceId}`))
        .catch((e: any) => logger.warn(`[Groups] enrichGroupNames erro: ${e.message}`));
      return;
    }

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
 * Sincroniza participantes de todos os grupos via fetchAllGroups?getParticipants=true.
 * Prioriza p.phoneNumber (campo explícito) antes do JID — Evolution v2 pode retornar
 * @lid como p.id mas ainda incluir o número real em p.phoneNumber.
 * Ignora grupos cujo bulk retornou muito menos participantes do que o tamanho esperado
 * (indica que a maioria era @lid) para não sobrescrever dados bons com dados degradados.
 */
export async function syncAllParticipants(instanceId: number, instanceName: string): Promise<void> {
  const key = String(instanceId);
  if (participantSyncRunning.has(key)) return;
  participantSyncRunning.add(key);

  try {
    logger.info(`[Groups] Sync participantes (bulk) para ${instanceName}`);

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
        // IMPORTANTE: prioriza p.phoneNumber antes do JID (p.id pode ser @lid)
        const jid: string = p.phoneNumber || p.id || p.jid || '';
        if (jid.endsWith('@lid') || jid.includes('@g.us')) continue;
        const phone = normalizeBrPhone(jid.replace('@s.whatsapp.net', '').replace('@c.us', ''));
        if (!phone) continue;
        participants.push(phone);
        if (p.admin === 'admin' || p.admin === 'superadmin' || p.isAdmin) admins.push(phone);
      }
      if (!participants.length) continue;

      // Não sobrescreve se o bulk retornou muito menos do que o tamanho real do grupo.
      // Isso indica que a maioria era @lid sem phoneNumber — dados degradados.
      const expectedSize = g.size || g.participants.length;
      if (expectedSize > 30 && participants.length < expectedSize * 0.25) {
        logger.info(`[Groups] ${gid}: bulk degradado (${participants.length}/${expectedSize} válidos) — mantendo DB`);
        continue;
      }

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
    // Prioriza p.phoneNumber antes do JID
    const jid: string = p.phoneNumber || p.id || p.jid || '';
    if (jid.endsWith('@lid') || jid.includes('@g.us')) continue;
    const phone = normalizeBrPhone(jid.replace('@s.whatsapp.net', '').replace('@c.us', ''));
    if (!phone) continue;
    participants.push(phone);
    if (p.admin === 'admin' || p.admin === 'superadmin' || p.isAdmin) admins.push(phone);
  }
  return { participants, admins };
}

/**
 * Busca participantes de um grupo.
 * ESTRATÉGIA: sempre tenta Evolution primeiro (dados frescos e corretos),
 * só usa banco como fallback se Evolution falhar/timeout.
 * Isso evita retornar dados sujos/desatualizados do cache.
 */
export async function getParticipants(instanceId: number, groupJid: string) {
  const instanceRow = await prisma.whatsAppInstance.findUnique({
    where: { id: instanceId }, select: { name: true }
  }).catch(() => null);
  const instanceName = instanceRow?.name || `instance_${instanceId}`;

  // ── 1. Evolution em tempo real (fonte de verdade) ─────────────────────────
  logger.info(`[Groups] Buscando participantes da Evolution para ${groupJid} (instância ${instanceName})`);
  try {
    const raw = await whatsappService.getGroupParticipants(instanceName, groupJid);
    if (raw.length > 0) {
      const { participants, admins } = parseRawParticipants(raw);
      logger.info(`[Groups] Evolution: ${raw.length} raw → ${participants.length} BR válidos para ${groupJid}`);
      if (participants.length > 0) {
        // Salva no banco em background (não bloqueia a resposta)
        prisma.whatsAppGroup.updateMany({
          where: { instanceId, groupId: groupJid },
          data: {
            participantsCount: participants.length,
            participantsList: { participants, admins } as any,
            participantsSyncedAt: new Date(),
          },
        }).catch(() => {});
        return { participants, admins, total: participants.length, source: 'evolution' };
      }
      logger.warn(`[Groups] Evolution retornou ${raw.length} participantes mas TODOS são @lid/@g.us — grupo usa privacidade LID do Meta`);
    } else {
      logger.warn(`[Groups] Evolution retornou lista vazia para ${groupJid}`);
    }
  } catch (err: any) {
    logger.warn(`[Groups] Evolution falhou para ${groupJid}: ${err.message}`);
  }

  // ── 2. Fallback: banco de dados (caso Evolution falhe/timeout) ─────────────
  const row = await prisma.whatsAppGroup.findFirst({
    where: { instanceId, groupId: groupJid },
    select: { participantsList: true, participantsSyncedAt: true, participantsCount: true },
  }).catch(() => null);

  const cached = row?.participantsList as any;
  if (cached?.participants?.length > 0) {
    // Reprocessa os números do banco pelo normalizeBrPhone para limpar dados sujos
    // (filtra LIDs, números internacionais e formatos inválidos)
    const participants: string[] = [];
    const admins: string[] = [];
    for (const p of cached.participants as string[]) {
      const phone = normalizeBrPhone(p);
      if (phone) participants.push(phone);
    }
    for (const a of (cached.admins || []) as string[]) {
      const phone = normalizeBrPhone(a);
      if (phone) admins.push(phone);
    }
    logger.info(`[Groups] DB fallback: ${(cached.participants as string[]).length} raw → ${participants.length} BR válidos para ${groupJid}`);
    if (participants.length > 0) {
      return { participants, admins, total: participants.length, source: 'db_cache' };
    }
  }

  logger.warn(`[Groups] Sem participantes BR válidos para ${groupJid} — Evolution retornou só @lid e DB está vazio/inválido`);
  return { participants: [], admins: [], total: 0, source: 'none' };
}
