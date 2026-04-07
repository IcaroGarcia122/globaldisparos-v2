import { Router, Response } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { authenticate, AuthRequest } from '../../middlewares/auth.middleware';
import prisma from '../../config/database';
import whatsappService from '../../services/whatsapp.service';
import { getParticipants } from '../../services/groups.service';
import { emitToUser, emitToCampaign } from '../../sockets/socket.server';
import { randomDelay } from '../../utils/delay';
import logger from '../../utils/logger';

/** Retorna o nome real da instância na Evolution (ex: "vvenda", não "instance_1") */
async function getEvolutionName(instanceId: number | string): Promise<string> {
  const id = parseInt(String(instanceId));
  if (isNaN(id)) return String(instanceId);
  const inst = await prisma.whatsAppInstance.findUnique({
    where: { id }, select: { name: true, phoneNumber: true }
  }).catch(() => null);
  if (!inst) return `instance_${id}`;

  const name = inst.name || `instance_${id}`;

  // Detecta nomes inválidos: padrão antigo "instance_N" ou sem nenhum char alfanumérico (ex: ".", " ")
  const isInvalidName = /^instance_\d+$/.test(name) || !/[a-zA-Z0-9]/.test(name);

  // Se nome inválido E temos número de telefone → buscar nome real na Evolution via phoneNumber
  if (isInvalidName && inst.phoneNumber) {
    try {
      const { default: ws } = await import('../../services/whatsapp.service');
      const all = await ws.fetchInstances().catch(() => []);
      const cleanPhone = inst.phoneNumber.replace(/\D/g, '');
      const match = all.find((i: any) => {
        const owner = (i.ownerJid || i.owner || i.owner_jid || '').replace('@s.whatsapp.net','').replace('@c.us','');
        const ownerClean = owner.replace(/\D/g,'');
        // Compara pelo sufixo (últimos 8 dígitos) para ignorar variações de código de país
        return ownerClean.length >= 8 && cleanPhone.endsWith(ownerClean.slice(-8));
      });
      // Só aceita nome válido: pelo menos 2 chars alfanuméricos
      const isValidEvName = (n: string) => !!(n && /[a-zA-Z0-9]/.test(n));
      if (match?.instanceName && isValidEvName(match.instanceName)) {
        // Atualizar nome no banco para futuras chamadas
        await prisma.whatsAppInstance.update({ where: { id }, data: { name: match.instanceName } }).catch(() => {});
        logger.info(`[Campaign] Corrigindo nome da instância ${id}: "${name}" → "${match.instanceName}"`);
        return match.instanceName;
      }
      // Fallback: buscar pelo nome direto na lista de instâncias da Evolution
      const byName = all.find((i: any) => i.instanceName && isValidEvName(i.instanceName) && i.instanceName !== name);
      if (all.length === 1 && byName?.instanceName) {
        await prisma.whatsAppInstance.update({ where: { id }, data: { name: byName.instanceName } }).catch(() => {});
        logger.info(`[Campaign] Corrigindo nome único da instância ${id}: "${name}" → "${byName.instanceName}"`);
        return byName.instanceName;
      }
    } catch { /* silencioso */ }
  }

  return name;
}

const router = Router();
router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Controle de campanhas em execução ────────────────────────────────────────
// Map local para controle de pause/cancel em tempo real (dentro do processo)
// O status canônico fica no banco — sobrevive a restarts
const runningCampaigns = new Map<number, { cancel: boolean; pause: boolean }>();

// Ao iniciar o servidor, marcar como 'cancelled' campanhas que ficaram presas em 'running'
// (isso acontece quando o processo é reiniciado com campanha em andamento)
async function resetStaleCampaigns() {
  try {
    const stale = await prisma.campaign.updateMany({
      where: { status: { in: ['running', 'paused'] } },
      data: { status: 'cancelled', completedAt: new Date() },
    });
    if (stale.count > 0) {
      logger.info(`[Campaign] ${stale.count} campanha(s) interrompida(s) pelo restart foram marcadas como canceladas`);
    }
  } catch (err: any) {
    logger.warn(`[Campaign] Erro ao limpar campanhas travadas: ${err.message}`);
  }
}
setTimeout(resetStaleCampaigns, 2000);

// ─── ANTI-BAN: randomiza o texto da mensagem levemente ───────────────────────
function randomizeMessage(template: string, contact: { number: string; name?: string }): string {
  let msg = template
    .replace(/{nome}/gi, contact.name || 'Amigo')
    .replace(/{numero}/gi, contact.number);

  // Adiciona variação invisível anti-ban (zero-width chars)
  const zwChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
  const zwChar = zwChars[Math.floor(Math.random() * zwChars.length)];
  return msg + zwChar;
}

// ─── EXECUÇÃO DE CAMPANHA EM BACKGROUND ──────────────────────────────────────
async function runCampaign(
  campaignId: number,
  instanceId: number,
  instanceName: string,
  contacts: Array<{ number: string; name?: string }>,
  message: string | string[],
  options: {
    intervalMs: number;
    randomizeInterval: boolean;
    randomizeMessage: boolean;
    excludeAdmins: boolean;
    adminNumbers?: string[];
  },
  userId: number
) {
  const startTime = Date.now();
  let sent = 0, failed = 0;
  runningCampaigns.set(campaignId, { cancel: false, pause: false });

  // Filtra admins se necessário
  let targets = contacts;
  if (options.excludeAdmins && options.adminNumbers?.length) {
    const adminSet = new Set(options.adminNumbers);
    targets = contacts.filter(c => !adminSet.has(c.number));
    logger.info(`[Campaign] Excluídos ${contacts.length - targets.length} admins`);
  }

  if (targets.length === 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'cancelled', completedAt: new Date() },
    });
    emitToUser(userId, 'campanha:erro', { campaignId, error: 'Nenhum contato após exclusão de admins' });
    runningCampaigns.delete(campaignId);
    return;
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { totalContacts: targets.length, messagesScheduled: targets.length },
  });

  try {
    for (let i = 0; i < targets.length; i++) {
      const ctrl = runningCampaigns.get(campaignId);
      if (ctrl?.cancel) break;

      // Checar status no banco (fonte de verdade — funciona mesmo após restart parcial)
      let camp = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
      if (!camp || camp.status === 'cancelled') break;

      // Aguarda se pausada (checa Map E banco)
      while (runningCampaigns.get(campaignId)?.pause || camp?.status === 'paused') {
        await new Promise(r => setTimeout(r, 2000));
        const recheck = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
        if (!recheck || recheck.status === 'cancelled') { runningCampaigns.get(campaignId) && (runningCampaigns.get(campaignId)!.cancel = true); break; }
        if (recheck.status === 'running') { if (runningCampaigns.get(campaignId)) runningCampaigns.get(campaignId)!.pause = false; break; }
        camp = recheck; // atualiza referência para próxima iteração do while
      }
      if (runningCampaigns.get(campaignId)?.cancel) break;

      const contact = targets[i];

      // Personaliza mensagem
      // Rotaciona entre variações a cada envio
      const msgList = Array.isArray(message) ? message : [message];
      const baseMsg = msgList.length > 1
        ? msgList[Math.floor(Math.random() * msgList.length)]
        : msgList[0];
      const finalMsg = options.randomizeMessage
        ? randomizeMessage(baseMsg, contact)
        : baseMsg.replace(/{nome}/gi, contact.name || 'Amigo').replace(/{numero}/gi, contact.number);

      try {
        await whatsappService.sendText(instanceName, contact.number, finalMsg);
        sent++;
        await prisma.whatsAppInstance.update({
          where: { id: instanceId },
          data: { totalMessagesSent: { increment: 1 }, dailyMessagesSent: { increment: 1 }, lastMessageAt: new Date() },
        }).catch(() => {});
      } catch (err: any) {
        failed++;
        logger.warn(`[Campaign] Falha ${contact.number}: ${err.message}`);
        await prisma.whatsAppInstance.update({
          where: { id: instanceId },
          data: { totalMessagesFailed: { increment: 1 } },
        }).catch(() => {});
      }

      if ((sent + failed) % 10 === 0 || i === targets.length - 1) {
        await prisma.campaign.update({ where: { id: campaignId }, data: { messagesSent: sent, messagesFailed: failed } });
      }

      // Emite progresso
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = sent / (elapsed || 1);
      const remaining = targets.length - i - 1;
      const eta = speed > 0 ? remaining / speed : 0;

      const progress = {
        campaignId, sent, failed, remaining,
        percentual: ((i + 1) / targets.length * 100).toFixed(1),
        elapsedSeconds: Math.round(elapsed),
        remainingSeconds: Math.round(eta),
        estimatedTotal: Math.round(targets.length / (speed || 1)),
        velocidade: speed.toFixed(2) + ' msgs/seg',
        currentContact: contact.number,
      };
      emitToUser(userId, 'campanha:progresso', progress);
      emitToCampaign(campaignId, 'campanha:progresso', progress);

      // Delay anti-ban
      if (i < targets.length - 1) {
        const minMs = options.intervalMs;
        const maxMs = options.randomizeInterval ? options.intervalMs * 1.5 : options.intervalMs;
        await randomDelay(minMs, Math.round(maxMs));
      }
    }

    const ctrl = runningCampaigns.get(campaignId);
    const finalStatus = ctrl?.cancel ? 'cancelled' : 'completed';
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: finalStatus, completedAt: new Date(), messagesSent: sent, messagesFailed: failed },
    });

    const result = {
      campaignId, totalSent: sent, totalFailed: failed,
      successRate: targets.length > 0 ? ((sent / targets.length) * 100).toFixed(1) + '%' : '0%',
      duration: ((Date.now() - startTime) / 1000).toFixed(0) + 's',
    };
    emitToUser(userId, 'campanha:concluida', result);
    emitToCampaign(campaignId, 'campanha:concluida', result);
    logger.info(`[Campaign] ✅ ${campaignId} finalizada: ${sent} enviadas, ${failed} erros`);

  } catch (err: any) {
    logger.error(`[Campaign] Erro: ${err.message}`);
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'cancelled', completedAt: new Date() } });
    emitToUser(userId, 'campanha:erro', { campaignId, error: err.message });
  } finally {
    runningCampaigns.delete(campaignId);
  }
}

// ─── POST /api/disparador/iniciar ─────────────────────────────────────────────
router.post('/iniciar', async (req: AuthRequest, res: Response) => {
  try {
    const {
      instanceId, groupIds, message, messages,
      interval = 3000,
      campaignName,
      randomizeInterval = false,
      randomizeMessage: doRandomize = true,
      excludeAdmins = false,
      skipAlreadySent = false,
      randomizeOrder = false,
    } = req.body;
    // Suporta múltiplas mensagens (variações anti-spam)
    const messageVariations: string[] = (messages?.length > 0 ? messages : [message]).filter(Boolean);
    const userId = req.user!.id;

    if (!instanceId) return res.status(400).json({ error: 'instanceId é obrigatório' });
    if (!message?.trim()) return res.status(400).json({ error: 'Mensagem é obrigatória' });

    const { xlsxNumbers = [] } = req.body;
    const hasGroups = groupIds?.length > 0;
    const hasXlsx = xlsxNumbers.length > 0;
    if (!hasGroups && !hasXlsx) return res.status(400).json({ error: 'Selecione um grupo ou carregue uma lista de números' });

    const instance = await prisma.whatsAppInstance.findUnique({ where: { id: parseInt(String(instanceId)) } });
    if (!instance) return res.status(404).json({ error: 'Instância não encontrada' });
    if (instance.userId !== userId) return res.status(403).json({ error: 'Acesso negado' });
    if (instance.status !== 'connected') return res.status(409).json({ error: 'Instância não está conectada' });

    // Verificar nome real da instância na Evolution ANTES de iniciar (evita 404 por nome inválido)
    const resolvedName = await getEvolutionName(instanceId);
    const isValidInstanceName = resolvedName && /[a-zA-Z0-9]/.test(resolvedName);
    if (!isValidInstanceName) {
      logger.error(`[Campaign] Nome inválido para instância ${instanceId}: "${resolvedName}". Reconfigure a instância na Evolution API.`);
      return res.status(409).json({ error: `Configuração inválida da instância "${instance.name}". Acesse Instâncias → Reconectar para corrigir.` });
    }

    // Coleta contatos — de grupos OU de lista xlsx
    const allContacts = new Map<string, { number: string; name?: string }>();
    const allAdmins = new Set<string>();

    if (hasGroups) {
      for (const groupId of groupIds) {
        try {
          const { participants, admins } = await getParticipants(parseInt(String(instanceId)), groupId);
          for (const phone of participants) {
            if (!allContacts.has(phone)) allContacts.set(phone, { number: phone });
          }
          admins.forEach((a: string) => allAdmins.add(a));
        } catch (err: any) {
          logger.warn(`[Campaign] Erro ao buscar participantes do grupo ${groupId}: ${err.message}`);
        }
      }
    }

    if (hasXlsx) {
      for (const num of xlsxNumbers) {
        const clean = String(num).replace(/\D/g, '');
        if (clean.length >= 10) allContacts.set(clean, { number: clean });
      }
    }

    if (allContacts.size === 0) {
      return res.status(400).json({ error: 'Nenhum contato encontrado' });
    }

    let contacts = Array.from(allContacts.values());

    // Randomizar ordem se solicitado
    if (randomizeOrder) {
      contacts = contacts.sort(() => Math.random() - 0.5);
    }

    // skipAlreadySent: requer tabela de histórico de envios — não implementado ainda

    const campaign = await prisma.campaign.create({
      data: {
        userId, instanceId: parseInt(String(instanceId)),
        name: campaignName || `Campanha ${new Date().toLocaleString('pt-BR')}`,
        message, status: 'running',
        totalContacts: contacts.length,
        messagesScheduled: contacts.length,
        intervalMs: interval,
        startedAt: new Date(),
      },
    });

    res.status(201).json({
      campaignId: campaign.id,
      totalContacts: contacts.length,
      message: `Campanha iniciada para ${contacts.length} contatos`,
      estimatedDuration: Math.round((contacts.length * interval) / 1000) + 's',
    });

    // Escolhe mensagem aleatória se houver variações
    const finalMessage = messageVariations.length > 1
      ? messageVariations[Math.floor(Math.random() * messageVariations.length)]
      : messageVariations[0] || message;

    runCampaign(
      campaign.id,
      parseInt(String(instanceId)),
      await getEvolutionName(instanceId),
      contacts,
      messageVariations.length > 1 ? messageVariations : finalMessage,
      { intervalMs: interval, randomizeInterval, randomizeMessage: doRandomize, excludeAdmins, adminNumbers: Array.from(allAdmins) },
      userId
    );

  } catch (err: any) {
    logger.error(`[Campaign] Erro ao iniciar: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/disparador/send-single ────────────────────────────────────────
router.post('/send-single', async (req: AuthRequest, res: Response) => {
  try {
    const { instanceId, number, message } = req.body;
    if (!instanceId || !number || !message) return res.status(400).json({ error: 'instanceId, number e message obrigatórios' });

    const instance = await prisma.whatsAppInstance.findUnique({ where: { id: parseInt(String(instanceId)) } });
    if (!instance) return res.status(404).json({ error: 'Instância não encontrada' });
    if (instance.userId !== req.user!.id) return res.status(403).json({ error: 'Acesso negado' });
    if (instance.status !== 'connected') return res.status(400).json({ error: 'Instância não conectada' });

    let sendSuccess = false;
    let sendError = '';
    try {
      const evName278 = await getEvolutionName(instanceId);
      await whatsappService.sendText(evName278, number, message);
      sendSuccess = true;
    } catch (sendErr: any) {
      sendError = sendErr.message || 'Erro ao enviar';
      // Evolution pode retornar erro mas ainda processar — logar e continuar
      logger.warn(`[Campaign] Aviso Evolution send-single ${number}: ${sendError}`);
      // Se o erro for de conexão real (não número inválido), propagar
      const isFatal = sendError.includes('ECONNREFUSED') || sendError.includes('timeout') || sendError.includes('network');
      if (isFatal) {
        return res.status(503).json({ success: false, error: sendError });
      }
      // Número inválido / não existe no WhatsApp — conta como skipped, não falha fatal
      return res.json({ success: false, skipped: true, error: sendError });
    }

    // Atualiza contador apenas se enviou com sucesso
    const instId = parseInt(String(instanceId));
    prisma.whatsAppInstance.update({
      where: { id: instId },
      data: { totalMessagesSent: { increment: 1 }, dailyMessagesSent: { increment: 1 }, lastMessageAt: new Date() },
    }).then(() => {
      logger.info(`[Campaign] ✅ Enviado para ${number} (instância ${instId})`);
    }).catch(e => logger.warn(`[Campaign] ⚠️ Falha ao incrementar contador instância ${instId}: ${e.message}`));

    return res.json({ success: true, number });
  } catch (err: any) {
    logger.warn(`[Campaign] send-single erro inesperado: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/disparador/enviar-xlsx ────────────────────────────────────────
router.post('/enviar-xlsx', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { instanceId, message, interval = 3000, randomizeInterval = false, randomizeMessage: doRandomize = true } = req.body;
    const userId = req.user!.id;

    if (!req.file) return res.status(400).json({ error: 'Arquivo XLSX obrigatório' });
    if (!instanceId || !message) return res.status(400).json({ error: 'instanceId e message obrigatórios' });

    const instance = await prisma.whatsAppInstance.findUnique({ where: { id: parseInt(instanceId) } });
    if (!instance) return res.status(404).json({ error: 'Instância não encontrada' });
    if (instance.userId !== userId) return res.status(403).json({ error: 'Acesso negado' });
    if (instance.status !== 'connected') return res.status(409).json({ error: 'Instância não conectada' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);

    const contacts: Array<{ number: string; name?: string }> = rows
      .map((r: any) => ({
        number: String(r.numero || r.phone || r.telefone || r.whatsapp || Object.values(r)[0] || '').replace(/\D/g, ''),
        name: r.nome || r.name || undefined,
      }))
      .filter(c => c.number.length >= 10);

    if (!contacts.length) return res.status(400).json({ error: 'Nenhum número válido no arquivo' });

    const campaign = await prisma.campaign.create({
      data: {
        userId, instanceId: parseInt(instanceId),
        name: `Disparo XLSX - ${new Date().toLocaleString('pt-BR')}`,
        message, status: 'running',
        totalContacts: contacts.length,
        messagesScheduled: contacts.length,
        intervalMs: parseInt(interval),
        startedAt: new Date(),
      },
    });

    res.status(201).json({ campaignId: campaign.id, totalContacts: contacts.length });
    const evNameRun = await getEvolutionName(instanceId);
    runCampaign(campaign.id, parseInt(instanceId), evNameRun, contacts, message,
      { intervalMs: parseInt(interval), randomizeInterval: Boolean(randomizeInterval), randomizeMessage: Boolean(doRandomize), excludeAdmins: false },
      userId
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET/POST /api/disparador/:id ─────────────────────────────────────────────

/** GET /api/campaigns/active — campanha em execução do usuário (para recuperar estado ao fazer login) */
router.get('/active', async (req: AuthRequest, res: Response) => {
  const campaign = await prisma.campaign.findFirst({
    where: { userId: req.user!.id, status: { in: ['running', 'paused'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!campaign) return res.json(null);
  const total = campaign.totalContacts, sent = campaign.messagesSent, failed = campaign.messagesFailed;
  return res.json({
    id: campaign.id,
    status: campaign.status,
    message: campaign.message,
    total,
    sent,
    failed,
    skipped: 0,
    startedAt: campaign.startedAt?.getTime() ?? Date.now(),
    estimatedEnd: null,
    current: '',
    numbers: [],
    currentIndex: sent,
    instanceId: String(campaign.instanceId),
  });
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const campaign = await prisma.campaign.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
  const progress = campaign.totalContacts > 0 ? (campaign.messagesSent / campaign.totalContacts) * 100 : 0;
  return res.json({ ...campaign, progress: progress.toFixed(1), successRate: progress.toFixed(1) + '%' });
});

router.post('/:id/pausar', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const ctrl = runningCampaigns.get(id);
  if (ctrl) ctrl.pause = true;
  await prisma.campaign.update({ where: { id }, data: { status: 'paused' } });
  return res.json({ message: 'Campanha pausada', campaignId: id });
});

router.post('/:id/retomar', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const ctrl = runningCampaigns.get(id);
  if (ctrl) ctrl.pause = false;
  await prisma.campaign.update({ where: { id }, data: { status: 'running' } });
  return res.json({ message: 'Campanha retomada', campaignId: id });
});

router.post('/:id/parar', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const ctrl = runningCampaigns.get(id);
  if (ctrl) ctrl.cancel = true;
  await prisma.campaign.update({ where: { id }, data: { status: 'cancelled', completedAt: new Date() } });
  return res.json({ message: 'Campanha parada', campaignId: id });
});

router.get('/:id/metricas', async (req: AuthRequest, res: Response) => {
  const campaign = await prisma.campaign.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
  const total = campaign.totalContacts, sent = campaign.messagesSent, failed = campaign.messagesFailed;
  const duration = campaign.completedAt && campaign.startedAt
    ? (campaign.completedAt.getTime() - campaign.startedAt.getTime()) / 1000 : null;
  return res.json({
    campaignId: campaign.id, status: campaign.status,
    timeline: { startedAt: campaign.startedAt, completedAt: campaign.completedAt, durationSeconds: duration },
    metrics: { total, sent, failed, pending: Math.max(0, total - sent - failed) },
    rates: {
      sent: total > 0 ? ((sent / total) * 100).toFixed(1) + '%' : '0%',
      errorRate: total > 0 ? ((failed / total) * 100).toFixed(1) + '%' : '0%',
    },
    throughput: duration ? ((total / duration) * 60).toFixed(1) + ' msgs/min' : null,
  });
});

// ─── /api/campaigns/* ─────────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { instanceId, name, message, intervalMs = 3000 } = req.body;
    const campaign = await prisma.campaign.create({
      data: { userId: req.user!.id, instanceId, name, message, intervalMs, status: 'pending' },
    });
    return res.status(201).json(campaign);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const campaigns = await prisma.campaign.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' } });
  return res.json(campaigns);
});


router.post('/:id/start', async (req: AuthRequest, res: Response) => {
  await prisma.campaign.update({ where: { id: parseInt(req.params.id) }, data: { status: 'running', startedAt: new Date() } });
  return res.json({ message: 'Campanha iniciada' });
});

router.post('/:id/pause', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const ctrl = runningCampaigns.get(id);
  if (ctrl) ctrl.pause = true;
  await prisma.campaign.update({ where: { id }, data: { status: 'paused' } });
  return res.json({ message: 'Campanha pausada' });
});

router.post('/:id/cancel', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const ctrl = runningCampaigns.get(id);
  if (ctrl) ctrl.cancel = true;
  await prisma.campaign.update({ where: { id }, data: { status: 'cancelled', completedAt: new Date() } });
  return res.json({ message: 'Campanha cancelada' });
});

router.get('/:id/progress', async (req: AuthRequest, res: Response) => {
  const campaign = await prisma.campaign.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
  const pct = campaign.totalContacts > 0 ? (campaign.messagesSent / campaign.totalContacts) * 100 : 0;
  return res.json({ ...campaign, percentage: pct.toFixed(1) });
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const campaign = await prisma.campaign.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
  return res.json(campaign);
});

router.post('/:id/status', async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  await prisma.campaign.update({ where: { id: parseInt(req.params.id) }, data: { status } });
  return res.json({ message: 'Status atualizado', status });
});

router.post('/:id/message', async (req: AuthRequest, res: Response) => {
  const { message } = req.body;
  await prisma.campaign.update({ where: { id: parseInt(req.params.id) }, data: { message } });
  return res.json({ message: 'Mensagem atualizada' });
});

router.post('/:id/speed', async (req: AuthRequest, res: Response) => {
  const { intervalMs } = req.body;
  await prisma.campaign.update({ where: { id: parseInt(req.params.id) }, data: { intervalMs } });
  return res.json({ message: 'Velocidade atualizada' });
});


// ─── POST /api/disparador/registrar ──────────────────────────────────────────
// Cria campanha no banco para rastrear progresso e permitir cancelamento
// O EliteDispatcher controla o envio (send-single), não o backend
router.post('/registrar', async (req: AuthRequest, res: Response) => {
  try {
    const { instanceId, message, groupId, totalContacts, campaignName } = req.body;
    const userId = req.user!.id;

    if (!instanceId || !message) return res.status(400).json({ error: 'instanceId e message obrigatórios' });

    const campaign = await prisma.campaign.create({
      data: {
        userId,
        instanceId: parseInt(String(instanceId)),
        name: campaignName || `Disparo ${new Date().toLocaleString('pt-BR')}`,
        message,
        status: 'running',
        totalContacts: totalContacts || 0,
        messagesScheduled: totalContacts || 0,
        startedAt: new Date(),
      },
    });

    return res.json({ campaignId: campaign.id, success: true });
  } catch (err: any) {
    logger.warn(`[Campaign] Erro ao registrar campanha: ${err.message}`);
    return res.json({ campaignId: null, success: false });
  }
});

// ─── POST /api/disparador/finalizar/:campaignId ───────────────────────────────
// Atualiza campanha como concluída após EliteDispatcher terminar
router.post('/finalizar/:campaignId', async (req: AuthRequest, res: Response) => {
  try {
    const campaignId = parseInt(req.params.campaignId);
    const { sent, failed, status = 'completed' } = req.body;
    const userId = req.user!.id;

    const sentNum = parseInt(String(sent)) || 0;
    const failedNum = parseInt(String(failed)) || 0;
    const finalStatus = status || 'completed';

    // updateMany com fallback sem userId para garantir que atualiza
    const result = await prisma.campaign.updateMany({
      where: { id: campaignId, userId },
      data: {
        status: finalStatus,
        messagesSent: sentNum,
        messagesFailed: failedNum,
        completedAt: new Date(),
      },
    });

    // Se não atualizou (userId não bateu), tenta sem userId
    if (result.count === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: finalStatus, messagesSent: sentNum, messagesFailed: failedNum, completedAt: new Date() },
      }).catch(() => {});
    }

    logger.info(`[Campaign] ✅ Finalizada id=${campaignId} sent=${sentNum} failed=${failedNum} status=${finalStatus} (updated=${result.count})`);
    return res.json({ success: true, campaignId, sent: sentNum, failed: failedNum });
  } catch (err: any) {
    logger.error(`[Campaign] Erro ao finalizar ${req.params.campaignId}: ${err.message}`);
    return res.json({ success: false, error: err.message });
  }
});

// ─── POST /api/disparador/cancelar/:campaignId ───────────────────────────────
router.post('/cancelar/:campaignId', async (req: AuthRequest, res: Response) => {
  try {
    const campaignId = parseInt(req.params.campaignId);
    const userId = req.user!.id;

    if (isNaN(campaignId)) return res.status(400).json({ error: 'campaignId inválido' });

    // Para loop de envio backend (se rodando via runCampaign)
    const ctrl = runningCampaigns.get(campaignId);
    if (ctrl) ctrl.cancel = true;

    // Atualizar status no banco
    await prisma.campaign.updateMany({
      where: { id: campaignId, userId },
      data: { status: 'cancelled', completedAt: new Date() },
    }).catch(() => {});

    logger.info(`[Campaign] Campanha ${campaignId} cancelada pelo usuário ${userId}`);
    return res.json({ success: true, campaignId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;