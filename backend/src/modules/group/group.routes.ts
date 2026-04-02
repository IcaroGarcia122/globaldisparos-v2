import { Router, Response, Request } from 'express';
import { authenticate, AuthRequest } from '../../middlewares/auth.middleware';
import { getGroups, syncGroupsBackground, saveGroupsFromWebhook, getParticipants, isSyncing, getSyncProgress, syncAllParticipants } from '../../services/groups.service';
import whatsappService from '../../services/whatsapp.service';
import prisma from '../../config/database';
import logger from '../../utils/logger';

const router = Router();

/** GET /api/groups?instanceId=X */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const instanceId = parseInt(req.query.instanceId as string);
  if (!instanceId) return res.status(400).json({ error: 'instanceId obrigatório' });

  const { groups, source } = await getGroups(instanceId);

  if (groups.length > 0) {
    // Retorna cache imediatamente, mas dispara sync em background para pegar grupos novos
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId }, select: { status: true },
    }).catch(() => null);
    if (instance?.status === 'connected' && !isSyncing(instanceId)) {
      syncGroupsBackground(instanceId).catch(() => {});
    }
    return res.json({ groups, loading: false, total: groups.length, source });
  }

  const instance = await prisma.whatsAppInstance.findUnique({
    where: { id: instanceId }, select: { status: true },
  }).catch(() => null);

  if (instance?.status !== 'connected') {
    return res.json({ groups: [], loading: false, total: 0, message: 'Instância não conectada' });
  }

  if (isSyncing(instanceId)) {
    return res.json({
      groups: [], loading: true, total: 0,
      message: getSyncProgress(instanceId) || 'Sincronizando grupos...',
    });
  }

  syncGroupsBackground(instanceId).catch(() => {});
  return res.json({ groups: [], loading: true, total: 0, message: 'Sync iniciado...' });
});

/** GET /api/groups/status/:instanceId */
router.get('/status/:instanceId', authenticate, async (req: AuthRequest, res: Response) => {
  const instanceId = parseInt(req.params.instanceId);
  const { groups } = await getGroups(instanceId);
  return res.json({
    loading: isSyncing(instanceId),
    progress: getSyncProgress(instanceId),
    total: groups.length,
    groups,
    done: groups.length > 0,
  });
});

/** GET /api/groups/sync/:instanceId — força sync */
router.get('/sync/:instanceId', authenticate, async (req: AuthRequest, res: Response) => {
  const instanceId = parseInt(req.params.instanceId);
  if (!isSyncing(instanceId)) {
    syncGroupsBackground(instanceId).catch(() => {});
  }
  return res.json({ message: 'Sync iniciado', loading: true });
});

/** POST /api/groups/sync/:instanceId */
router.post('/sync/:instanceId', authenticate, async (req: AuthRequest, res: Response) => {
  const instanceId = parseInt(req.params.instanceId);
  if (!isSyncing(instanceId)) {
    syncGroupsBackground(instanceId).catch(() => {});
  }
  return res.json({ message: 'Sync iniciado', loading: true });
});

/** 
 * POST /api/groups/inject/:instanceId
 * Endpoint de debug: injeta grupos manualmente via payload
 * Útil para testar sem depender do webhook
 */
router.post('/inject/:instanceId', authenticate, async (req: AuthRequest, res: Response) => {
  const instanceId = parseInt(req.params.instanceId);
  const { groups } = req.body;
  if (!groups?.length) return res.status(400).json({ error: 'groups[] obrigatório' });
  const saved = await saveGroupsFromWebhook(instanceId, groups);
  return res.json({ saved, message: `${saved} grupos injetados` });
});

/** GET /api/groups/participants/:instanceId/:groupId */
router.get('/participants/:instanceId/:groupId', authenticate, async (req: AuthRequest, res: Response) => {
  const instanceId = parseInt(req.params.instanceId);
  const { groupId } = req.params;
  try {
    const result = await getParticipants(instanceId, groupId);
    return res.json({ ...result, groupId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/groups/admin-only/:instanceId — grupos onde a instância é admin/dono */
router.get('/admin-only/:instanceId', authenticate, async (req: AuthRequest, res: Response) => {
  const instanceId = parseInt(req.params.instanceId);
  try {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
      select: { name: true, phoneNumber: true, status: true },
    });
    const instanceName = instance?.name || `instance_${instanceId}`;
    const ownerPhone = (instance?.phoneNumber || '').replace(/\D/g, '');
    const suffix = ownerPhone.slice(-8);
    logger.info(`[AdminGroups] instanceId=${instanceId} phone="${ownerPhone}" instanceName="${instanceName}"`);

    if (!ownerPhone) {
      return res.status(400).json({ error: 'Número da instância não encontrado. Reconecte o WhatsApp.' });
    }

    // ── Busca direto da Evolution com participantes ────────────────────────────
    const baseURL = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081').replace('localhost', '127.0.0.1');
    const apiKey  = process.env.EVOLUTION_API_KEY || '';

    let adminGroups: { groupId: string; name: string; participantsCount: number }[] = [];

    try {
      const axios = (await import('axios')).default;
      const res2 = await axios.get(
        `${baseURL}/group/fetchAllGroups/${instanceName}?getParticipants=true`,
        { headers: { apikey: apiKey }, timeout: 90000 }
      );
      const raw = Array.isArray(res2.data) ? res2.data : (res2.data?.groups || res2.data?.value || []);
      logger.info(`[AdminGroups] Evolution retornou ${raw.length} grupos`);

      for (const g of raw) {
        const gid: string = g.id || g.jid || '';
        if (!gid.includes('@g.us')) continue;

        // Checa pelo campo owner (criador)
        const ownerJid = (g.owner || g.ownerJid || '').replace(/\D/g, '');
        const isOwner = ownerJid.length > 0 && ownerJid.endsWith(suffix);

        // Checa se está na lista de participantes como admin
        let isAdmin = false;
        if (Array.isArray(g.participants)) {
          isAdmin = g.participants.some((p: any) => {
            const pJid = (p.id || p.jid || p.phoneNumber || '').replace(/\D/g, '');
            return pJid.endsWith(suffix) && (p.admin === 'admin' || p.admin === 'superadmin');
          });

          // Salva participantes no banco em background
          const participants: string[] = [];
          const admins: string[] = [];
          for (const p of g.participants) {
            const jid: string = p.id || p.jid || p.phoneNumber || '';
            const phone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
            if (!phone || phone.length < 8) continue;
            participants.push(phone);
            if (p.admin === 'admin' || p.admin === 'superadmin') admins.push(phone);
          }
          if (participants.length > 0) {
            prisma.whatsAppGroup.updateMany({
              where: { instanceId, groupId: gid },
              data: { participantsList: { participants, admins } as any, participantsCount: participants.length, participantsSyncedAt: new Date() },
            }).catch(() => {});
          }
        }

        if (isOwner || isAdmin) {
          adminGroups.push({ groupId: gid, name: g.subject || g.name || gid.slice(-12), participantsCount: g.size || g.participants?.length || 0 });
        }
      }

      logger.info(`[AdminGroups] ${adminGroups.length} grupos onde ${ownerPhone} é admin/dono`);

      if (adminGroups.length > 0) {
        return res.json({ groups: adminGroups, source: 'evolution' });
      }
    } catch (evErr: any) {
      logger.warn(`[AdminGroups] Evolution falhou (${evErr.message}) — usando banco`);
    }

    // ── Fallback: banco de dados (participantsList já populado) ───────────────
    const dbGroups = await prisma.whatsAppGroup.findMany({
      where: { instanceId },
      orderBy: { name: 'asc' },
      select: { groupId: true, name: true, participantsCount: true, participantsList: true },
    });

    if (dbGroups.length === 0) {
      syncGroupsBackground(instanceId).catch(() => {});
      return res.json({ groups: [], warning: 'Nenhum grupo no banco. Sincronização iniciada — recarregue em 30 segundos.' });
    }

    const adminFromDb = dbGroups.filter(g => {
      const pl = g.participantsList as any;
      if (!pl?.admins?.length) return false;
      return pl.admins.some((a: string) => a.replace(/\D/g, '').endsWith(suffix));
    });

    if (adminFromDb.length > 0) {
      logger.info(`[AdminGroups] ${adminFromDb.length} grupos admin via banco`);
      return res.json({
        groups: adminFromDb.map(g => ({ groupId: g.groupId, name: g.name, participantsCount: g.participantsCount })),
        source: 'database_admins',
      });
    }

    // Banco sem dados de admin — retorna todos e dispara sync
    syncAllParticipants(instanceId, instanceName).catch(() => {});
    return res.json({
      groups: dbGroups.map(g => ({ groupId: g.groupId, name: g.name, participantsCount: g.participantsCount })),
      source: 'database_all',
      warning: 'Sincronizando dados de admin. Recarregue em 30 segundos para filtrar apenas seus grupos.',
    });
  } catch (err: any) {
    logger.error(`[AdminGroups] Erro: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:groupId/participants', authenticate, async (req: AuthRequest, res: Response) => {
  const instanceId = parseInt(req.query.instanceId as string);
  const { groupId } = req.params;
  if (!instanceId) return res.status(400).json({ error: 'instanceId obrigatório' });
  const result = await getParticipants(instanceId, groupId);
  return res.json(result.participants.map(p => ({ id: p, jid: `${p}@s.whatsapp.net` })));
});

/** POST /api/groups/:groupId/dispatch */
router.post('/:groupId/dispatch', authenticate, async (req: AuthRequest, res: Response) => {
  return res.json({ message: 'Use /api/disparador/iniciar' });
});

/** 
 * GET /api/groups/debug/:instanceId/:groupId
 * Testa todos os endpoints de participantes — útil para diagnosticar
 */
router.get('/debug/:instanceId/:groupId', authenticate, async (req: AuthRequest, res: Response) => {
  const instanceId = parseInt(req.params.instanceId);
  const groupId = decodeURIComponent(req.params.groupId);
  const instRow = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId }, select: { name: true } }).catch(() => null);
  const instanceName = instRow?.name || `instance_${instanceId}`;

  const results: any = { groupId, endpoints: [] };

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
    } catch (e: any) {
      results.endpoints.push({ ep, status: e.response?.status || 'timeout', error: e.message });
    }
  }

  return res.json(results);
});




/** POST /api/groups/add-participants/:instanceId/:groupId
 *  Body: { participants: ["5511..."], delaySeconds?: number }
 *  Adiciona um por um com delay configurável (mín 35s)
 */
router.post('/add-participants/:instanceId/:groupId', authenticate, async (req: AuthRequest, res: Response) => {
  const instanceId   = parseInt(req.params.instanceId);
  const { groupId }  = req.params;
  const { participants, delaySeconds = 45 } = req.body;

  if (!participants || !Array.isArray(participants) || participants.length === 0) {
    return res.status(400).json({ error: 'participants deve ser array não vazio' });
  }

  // Delay mínimo de 35s por segurança
  const delay = Math.max(35, parseInt(String(delaySeconds)) || 45);

  try {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId }, select: { name: true },
    });
    const instanceName = instance?.name || `instance_${instanceId}`;

    const success: string[] = [];
    const failed:  string[] = [];

    for (const phone of participants) {
      try {
        await whatsappService.addParticipants(instanceName, groupId, [phone]);
        success.push(phone);
        logger.info(`[AddParticipants] ✅ ${phone} adicionado ao grupo ${groupId}`);
      } catch (err: any) {
        failed.push(phone);
        logger.warn(`[AddParticipants] ❌ Falha ${phone}: ${err.message}`);
      }
      // Delay entre cada adição (exceto após o último)
      if (phone !== participants[participants.length - 1]) {
        await new Promise(r => setTimeout(r, delay * 1000));
      }
    }

    return res.json({ success, failed, total: participants.length, delayUsed: delay });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/groups/test-add/:instanceId/:groupId — testa qual endpoint funciona */
router.get('/test-add/:instanceId/:groupId', authenticate, async (req: AuthRequest, res: Response) => {
  const instanceId = parseInt(req.params.instanceId);
  const { groupId } = req.params;
  const baseURL = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081').replace('localhost','127.0.0.1');
  const apiKey  = process.env.EVOLUTION_API_KEY || '';
  const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId }, select: { name: true } });
  const instanceName = instance?.name || `instance_${instanceId}`;
  
  const testBody = JSON.stringify({ action: 'add', participants: ['5500000000000@s.whatsapp.net'] });
  const headers  = { 'Content-Type': 'application/json', 'apikey': apiKey };
  
  const endpoints = [
    { method: 'POST', url: `${baseURL}/group/updateParticipant/${instanceName}?groupJid=${groupId}` },
    { method: 'POST', url: `${baseURL}/group/updateParticipant/${instanceName}`, body: JSON.stringify({ groupJid: groupId, action:'add', participants:[] }) },
    { method: 'PUT',  url: `${baseURL}/group/updateParticipant/${instanceName}?groupJid=${groupId}` },
  ];

  const results: any[] = [];
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep.url, { method: ep.method, headers, body: ep.body || testBody });
      const text = await r.text();
      results.push({ method: ep.method, url: ep.url, status: r.status, body: text.slice(0, 200) });
    } catch (e: any) {
      results.push({ method: ep.method, url: ep.url, error: e.message });
    }
  }
  return res.json({ instanceName, groupId, results });
});

/** POST /api/groups/sync-participants/:instanceId — sincroniza participantes de todos os grupos */
router.post('/sync-participants/:instanceId', authenticate, async (req: AuthRequest, res: Response) => {
  const instanceId = parseInt(req.params.instanceId);
  try {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId }, select: { name: true }
    });
    const instanceName = instance?.name || `instance_${instanceId}`;

    logger.info(`[Groups] Iniciando sync de participantes para ${instanceName}...`);

    // Responde imediatamente — processo é demorado
    res.json({ message: 'Sincronização iniciada em background. Pode levar 1-3 minutos.', instanceName });

    // Executar em background
    setImmediate(async () => {
      try {
        const evRes = await (await import("axios")).default.get(
          `/group/fetchAllGroups/${instanceName}?getParticipants=true`,
          { timeout: 180000 }
        );
        const raw = Array.isArray(evRes.data) ? evRes.data : (evRes.data?.groups || []);
        let synced = 0;

        for (const g of raw) {
          const gid: string = g.id || g.jid || '';
          if (!gid.includes('@g.us') || !g.participants?.length) continue;

          const participants: string[] = [];
          const admins: string[] = [];
          for (const p of g.participants) {
            const jid: string = p.id || p.jid || '';
            const phone = jid.replace('@s.whatsapp.net','').replace('@c.us','');
            if (phone.length < 8) continue;
            participants.push(phone);
            if (p.admin === 'admin' || p.admin === 'superadmin') admins.push(phone);
          }

          if (participants.length > 0) {
            await prisma.whatsAppGroup.updateMany({
              where: { instanceId, groupId: gid },
              data: {
                participantsList: { participants, admins } as any,
                participantsCount: participants.length,
                participantsSyncedAt: new Date(),
              },
            }).catch(() => {});
            synced++;
          }
        }
        logger.info(`[Groups] ✅ Sync participantes concluído: ${synced} grupos atualizados`);
      } catch (err: any) {
        logger.warn(`[Groups] Sync participantes falhou: ${err.message}`);
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/groups/export-xlsx/:instanceId/:groupId — exporta participantes como XLSX */
router.get('/export-xlsx/:instanceId/:groupId', authenticate, async (req: AuthRequest, res: Response) => {
  const instanceId = parseInt(req.params.instanceId);
  const { groupId } = req.params;
  const excludeAdmins = req.query.excludeAdmins === 'true';

  try {
    // Usa getParticipants que busca do banco OU da Evolution automaticamente
    const result = await getParticipants(instanceId, groupId);
    const participants: string[] = result.participants || [];
    const admins: string[]       = result.admins || [];

    // Nome do grupo para o filename
    const row = await prisma.whatsAppGroup.findFirst({
      where: { instanceId, groupId },
      select: { name: true },
    });

    if (participants.length === 0) {
      return res.status(404).json({
        error: 'Não foi possível obter os participantes deste grupo. Verifique se a instância está conectada e tente novamente.',
      });
    }

    // Filtrar admins se solicitado
    const list = excludeAdmins
      ? participants.filter((p: string) => !admins.includes(p))
      : participants;

    const rows = [['#', 'Telefone', 'Admin', 'Numero_Whatsapp']];
    list.forEach((phone: string, i: number) => {
      const isAdmin = admins.includes(phone) ? 'SIM' : 'NAO';
      rows.push([(i + 1).toString(), phone, isAdmin, `+${phone}`]);
    });

    const bom = '\uFEFF';
    const csv = bom + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\r\n');

    const groupName = (row?.name || groupId).replace(/[^a-zA-Z0-9_\-\u00C0-\u017F ]/g, '_').slice(0, 40);
    const date = new Date().toISOString().split('T')[0];
    const filename = `contatos_${groupName}_${date}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/groups/sync-participants/:instanceId
 *  Busca participantes de TODOS os grupos e salva no banco
 *  Deve ser chamado uma vez para popular o cache inicial
 */
router.post('/sync-participants/:instanceId', authenticate, async (req: AuthRequest, res: Response) => {
  const instanceId = parseInt(req.params.instanceId);
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { id: instanceId }, select: { name: true }
  });
  const instanceName = instance?.name || `instance_${instanceId}`;

  // Buscar todos os grupos do banco
  const groups = await prisma.whatsAppGroup.findMany({
    where: { instanceId },
    select: { groupId: true, name: true }
  });

  if (groups.length === 0) {
    return res.json({ message: 'Nenhum grupo no banco. Sincronize os grupos primeiro.', synced: 0 });
  }

  logger.info(`[SyncParticipants] Iniciando para ${instanceName} — ${groups.length} grupos`);

  // Processar em background para não travar o request
  res.json({ message: `Sincronizando participantes de ${groups.length} grupos em background...`, total: groups.length });

  // Background
  (async () => {
    let synced = 0;
    const baseURL = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081').replace('localhost','127.0.0.1');
    const apiKey  = process.env.EVOLUTION_API_KEY || '';
    const headers = { 'Content-Type': 'application/json', 'apikey': apiKey };

    for (const g of groups) {
      try {
        const url = `${baseURL}/group/findParticipants/${instanceName}?groupJid=${g.groupId}`;
        const r   = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
        if (!r.ok) continue;
        const data: any = await r.json();
        const raw: any[] = data?.participants || data?.members || (Array.isArray(data) ? data : []);
        if (raw.length === 0) continue;

        const participants: string[] = [];
        const admins: string[] = [];
        for (const p of raw) {
          const jid: string = p.id || p.jid || p.phoneNumber || '';
          const phone = jid.replace('@s.whatsapp.net','').replace('@c.us','').replace(/\D/g,'');
          if (!phone || phone.length < 8) continue;
          participants.push(phone);
          if (p.admin === 'admin' || p.admin === 'superadmin') admins.push(phone);
        }
        if (participants.length === 0) continue;

        await prisma.whatsAppGroup.updateMany({
          where: { instanceId, groupId: g.groupId },
          data: { participantsCount: participants.length, participantsList: { participants, admins } as any, participantsSyncedAt: new Date() },
        }).catch(() => {});
        synced++;
      } catch { /* grupo falhou, continua */ }

      // Pequeno delay para não sobrecarregar a Evolution
      await new Promise(r => setTimeout(r, 200));
    }
    logger.info(`[SyncParticipants] Concluído: ${synced}/${groups.length} grupos sincronizados para ${instanceName}`);
  })();
});

export default router;