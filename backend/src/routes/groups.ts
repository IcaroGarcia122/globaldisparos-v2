import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import axios from 'axios';
import { WhatsAppInstance, WhatsAppGroup } from '../models';

const router = Router();

const groupsCache = new Map<string, { groups: any[]; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;
const fetchingNow = new Set<string>();

const getEvolutionUrl = () =>
  (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081').replace('localhost', '127.0.0.1');
const getApiKey = () => process.env.EVOLUTION_API_KEY || '';

async function fetchGroupsInBackground(instanceId: string): Promise<void> {
  if (fetchingNow.has(instanceId)) return;
  fetchingNow.add(instanceId);

  const evolutionName = `instance_${instanceId}`;
  logger.info(`[GROUPS-BG] Buscando grupos de ${evolutionName}...`);

  try {
    const response = await axios.get(
      `${getEvolutionUrl()}/group/fetchAllGroups/${evolutionName}?getParticipants=false`,
      { headers: { apikey: getApiKey() }, timeout: 300000 }
    );

    const raw: any[] = Array.isArray(response.data) ? response.data : response.data?.groups || [];
    const groups = raw
      .filter((g: any) => (g.id || g.groupId || '').includes('@g.us'))
      .map((g: any) => ({
        id: g.id || g.groupId,
        name: g.subject || g.name || 'Sem nome',
        participantsCount: g.size || g.participants?.length || 0,
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    groupsCache.set(instanceId, { groups, timestamp: Date.now() });
    logger.info(`[GROUPS-BG] ${groups.length} grupos carregados para instância ${instanceId}`);

    // Salva no banco
    try {
      await WhatsAppGroup.destroy({ where: { instanceId: parseInt(instanceId) } });
      if (groups.length > 0) {
        await WhatsAppGroup.bulkCreate(
          groups.map((g: any) => ({
            instanceId: parseInt(instanceId),
            groupId: g.id,
            name: g.name,
            participantsCount: g.participantsCount,
            extractedAt: new Date(),
          })),
          { ignoreDuplicates: true }
        );
      }
    } catch (dbErr: any) {
      logger.warn(`[GROUPS-BG] Erro ao salvar no banco: ${dbErr.message}`);
    }
  } catch (err: any) {
    logger.error(`[GROUPS-BG] Erro ao buscar grupos: ${err.message}`);
  } finally {
    fetchingNow.delete(instanceId);
  }
}

// ============================================
// GET /api/groups?instanceId=X
// ============================================
router.get('/', authenticate, async (req: AuthRequest, res) => {
  const instanceId = req.query.instanceId as string;
  if (!instanceId) return res.status(400).json({ error: 'instanceId obrigatório' });

  // Cache válido?
  const cached = groupsCache.get(instanceId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.json({ groups: cached.groups, loading: false, source: 'cache' });
  }

  // Tenta banco
  try {
    const dbGroups = await WhatsAppGroup.findAll({
      where: { instanceId: parseInt(instanceId) },
      order: [['name', 'ASC']],
    });
    if (dbGroups.length > 0) {
      const groups = dbGroups.map((g: any) => ({
        id: g.groupId,
        name: g.name,
        participantsCount: g.participantsCount,
      }));
      groupsCache.set(instanceId, { groups, timestamp: Date.now() });

      // Atualiza em background se cache for antigo (>30min)
      const age = Date.now() - (dbGroups[0] as any).extractedAt?.getTime?.() || 0;
      if (age > 30 * 60 * 1000) fetchGroupsInBackground(instanceId);

      return res.json({ groups, loading: false, source: 'db' });
    }
  } catch { /* ignora */ }

  // Dispara fetch em background e retorna loading
  if (!fetchingNow.has(instanceId)) {
    fetchGroupsInBackground(instanceId);
  }

  return res.json({ groups: [], loading: true, message: 'Carregando grupos em background...' });
});

// ============================================
// GET /api/groups/status/:instanceId
// ============================================
router.get('/status/:instanceId', authenticate, async (req: AuthRequest, res) => {
  const { instanceId } = req.params;
  const cached = groupsCache.get(instanceId);
  const isFetching = fetchingNow.has(instanceId);

  res.json({
    loading: isFetching,
    hasData: !!cached && cached.groups.length > 0,
    groupCount: cached?.groups.length || 0,
    lastUpdated: cached?.timestamp || null,
  });
});

// ============================================
// GET /api/groups/sync/:instanceId — força re-fetch
// ============================================
router.get('/sync/:instanceId', authenticate, async (req: AuthRequest, res) => {
  const { instanceId } = req.params;

  groupsCache.delete(instanceId);
  fetchGroupsInBackground(instanceId);

  res.json({ message: 'Sincronização iniciada', loading: true });
});

// ============================================
// GET /api/groups/participants/:instanceId/:groupId
// Retorna lista de números para disparo
// ============================================
router.get('/participants/:instanceId/:groupId', authenticate, async (req: AuthRequest, res) => {
  const { instanceId, groupId } = req.params;
  const evolutionName = `instance_${instanceId}`;

  try {
    logger.info(`[GROUPS] Buscando participantes de ${groupId} em ${evolutionName}`);

    const response = await axios.get(
      `${getEvolutionUrl()}/group/participants/${evolutionName}?groupJid=${encodeURIComponent(groupId)}`,
      { headers: { apikey: getApiKey() }, timeout: 60000 }
    );

    let participants: any[] = response.data?.participants || response.data || [];
    if (!Array.isArray(participants)) participants = [];

    const numbers = participants
      .map((p: any) => {
        const jid = p.id || p.jid || p.number || '';
        return jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
      })
      .filter((n: string) => n && n.length >= 8 && !n.includes('@g.us'));

    logger.info(`[GROUPS] ${numbers.length} participantes encontrados`);
    res.json({ participants: numbers, total: numbers.length });
  } catch (err: any) {
    logger.error(`[GROUPS] Erro ao buscar participantes: ${err.message}`);

    // Fallback: tenta fetchAllGroups com getParticipants=true
    try {
      const fallback = await axios.get(
        `${getEvolutionUrl()}/group/fetchAllGroups/${evolutionName}?getParticipants=true`,
        { headers: { apikey: getApiKey() }, timeout: 120000 }
      );
      const raw: any[] = Array.isArray(fallback.data) ? fallback.data : fallback.data?.groups || [];
      const group = raw.find((g: any) => (g.id || g.groupId) === groupId);
      const participants = group?.participants || [];

      const numbers = participants
        .map((p: any) => {
          const jid = p.id || p.jid || '';
          return jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
        })
        .filter((n: string) => n && n.length >= 8);

      logger.info(`[GROUPS-FALLBACK] ${numbers.length} participantes encontrados`);
      res.json({ participants: numbers, total: numbers.length });
    } catch (fallbackErr: any) {
      res.status(500).json({ error: `Erro ao buscar participantes: ${fallbackErr.message}` });
    }
  }
});

export default router;