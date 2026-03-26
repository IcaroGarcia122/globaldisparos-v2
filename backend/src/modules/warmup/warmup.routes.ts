import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middlewares/auth.middleware';
import whatsappService from '../../services/whatsapp.service';
import prisma from '../../config/database';
import { emitToUser } from '../../sockets/socket.server';
import logger from '../../utils/logger';

const router = Router();
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// FASES DE AQUECIMENTO (loop 100% no backend — sobrevive a navegação do browser)
// ─────────────────────────────────────────────────────────────────────────────
const PHASES = [
  {
    id: 1, name: 'Ativação', days: [1, 3],
    msgsMin: 2, msgsMax: 3,
    delayMinSec: 180, delayMaxSec: 360,
    intraSec: [25, 50],
    messages: [
      'Oi tudo bem?',
      'Olá, como você está?',
      'Bom dia!',
      'Boa tarde!',
      'Boa noite!',
      'Oi, tudo certo por aí?',
      'Olá! Tudo bem?',
      'Ei, como vai?',
      'Oi, estava pensando em você.',
      'Tudo bem por aí?',
      'Como você está hoje?',
      'Boa semana pra você!',
    ],
  },
  {
    id: 2, name: 'Conversação', days: [4, 7],
    msgsMin: 3, msgsMax: 5,
    delayMinSec: 120, delayMaxSec: 300,
    intraSec: [20, 45],
    messages: [
      'Oi, como você está? Faz tempo que não conversamos.',
      'Tudo bem por aí? Aqui tá tudo ótimo.',
      'Boa tarde! Passando pra dar um alô.',
      'Oi! Saudades de conversar com você.',
      'Como estão as coisas por aí?',
      'Tudo certo? Qualquer coisa pode falar.',
      'Oi! Boa semana pra você e à família.',
      'Passando pra dar oi! Como vai?',
      'Até mais, cuida-se!',
      'Oi, estava com saudades de conversar.',
      'Boa tarde, espero que esteja bem!',
      'Como foi o seu dia até agora?',
      'Tudo tranquilo por aí? Aqui sim.',
      'Oi! Que bom saber que você está bem.',
    ],
  },
  {
    id: 3, name: 'Engajamento', days: [8, 14],
    msgsMin: 4, msgsMax: 8,
    delayMinSec: 90, delayMaxSec: 210,
    intraSec: [15, 35],
    messages: [
      'Oi! Como você está? Faz tempo que não conversamos, que saudades.',
      'Tudo bem? Espero que esteja tudo ótimo por aí com você e a família.',
      'Boa tarde! Passando aqui só pra saber como você está.',
      'Ei, tudo bem? Que saudade de conversar com você!',
      'Como estão as coisas? Aqui tá corrido mas tudo bem.',
      'Boa noite! Espero que o dia tenha sido ótimo para você.',
      'Oi! Já faz um tempo. Como você tá, está tudo bem?',
      'Tudo certo? Qualquer coisa que precisar pode me chamar.',
      'Passando rapidinho pra dar oi e mandar um abraço!',
      'Oi! Bom dia, que sua semana seja muito boa e produtiva!',
      'Ei, como vai? Qualquer novidade pode me contar!',
      'Boa tarde! Espero que esteja aproveitando bem o dia.',
      'Como você está se sentindo hoje? Espero que bem!',
      'Oi! Estava pensando em você e resolvi dar um oi.',
      'Tudo bem por aí? Aqui tranquilo, felizmente.',
    ],
  },
  {
    id: 4, name: 'Volume', days: [15, 21],
    msgsMin: 6, msgsMax: 12,
    delayMinSec: 60, delayMaxSec: 150,
    intraSec: [12, 30],
    messages: [
      'Oi! Como você está? Estou passando para dar um oi rápido.',
      'Bom dia! Que seu dia seja muito produtivo e cheio de boas notícias.',
      'Boa tarde! Espero que tudo esteja bem por aí.',
      'Boa noite! Que seu descanso seja merecido e revigorante.',
      'Ei! Sumiu. Tudo bem com você?',
      'Tudo ótimo por aqui! E aí, como estão as coisas?',
      'Oi! Estava com saudades de bater um papo.',
      'Como está a família? Espero que todos bem e com saúde!',
      'Que semana cheia! Mas estou bem. E você, como vai?',
      'Oi! Acabei de pensar em você e resolvi mandar mensagem.',
      'Está tudo bem? Aqui tá tranquilo, felizmente.',
      'Bom dia! Mais um dia cheio de oportunidades. Aproveite bem!',
      'Oi! Não se esquece de tomar bastante água hoje.',
      'Boa tarde! Espero que o trabalho esteja indo bem.',
      'Oi! Você está bem? Sempre bom falar com você.',
      'Bom dia! Que hoje seja um dia muito abençoado pra você.',
      'Como vai a vida? Por aqui tudo ótimo, graças a Deus.',
      'Boa noite! Que seus sonhos sejam muito bons.',
    ],
  },
  {
    id: 5, name: 'Manutenção', days: [22, 9999],
    msgsMin: 8, msgsMax: 15,
    delayMinSec: 45, delayMaxSec: 120,
    intraSec: [10, 25],
    messages: [
      'Oi! Tudo bem? Passando para dar oi como sempre.',
      'Bom dia! Energia total hoje? Que seu dia seja incrível.',
      'Boa tarde! Como estão as coisas por aí?',
      'Ei! Sumiu um pouco. Como você está?',
      'Oi! Bom dia, que sua semana comece muito bem.',
      'Boa tarde! Como foi o dia até agora?',
      'Oi! Qualquer coisa pode contar comigo, tá?',
      'Boa noite! Descanso merecido hoje?',
      'Passando rapidinho! Oi, como vai?',
      'Ei! Tudo certo? Aqui tudo tranquilo.',
      'Bom dia! Mais uma semana chegando, vamos nessa!',
      'Oi! Espero que esteja aproveitando bem a vida.',
      'Boa tarde! Como você está se sentindo hoje?',
      'Ei! Você é incrível, sabia? Continue assim.',
      'Bom dia! O dia está lindo, aproveite bastante.',
      'Oi! Boa semana pra você e à família, cuida-se.',
      'Boa noite! Que seus planos para amanhã deem certo.',
      'Ei! Passou um tempo, como vai tudo por aí?',
      'Oi! Só pra lembrar que você é especial pra mim.',
      'Bom dia! Que venha mais um dia cheio de conquistas.',
    ],
  },
];

function getPhase(day: number) {
  return PHASES.find(p => day >= p.days[0] && day <= p.days[1]) ?? PHASES[4];
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickMsg(phase: typeof PHASES[0]) {
  return phase.messages[Math.floor(Math.random() * phase.messages.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO EM MEMÓRIA — sobrevive enquanto o servidor Node estiver rodando
// ─────────────────────────────────────────────────────────────────────────────
interface WarmupState {
  running: boolean;
  instanceId: number;
  userId: number;
  phone: string;
  instanceName: string;
  day: number;
  sessionSent: number;
  sessionsToday: number;  // sessões completadas no dia atual
  totalSent: number;
  currentPhaseId: number;
  lastMessage: string;
  nextMsgAt: number;
  startedAt: number;      // timestamp ms do primeiro início
  lastDayAt: number;      // timestamp ms do início do dia atual (para saber quando virar o dia)
  timer: NodeJS.Timeout | null;
  logs: Array<{ time: string; msg: string; phaseId: number; type: 'sent' | 'error' | 'info' }>;
}

const activeWarmups = new Map<string, WarmupState>();

// ─── Auto-retomada ao iniciar o servidor ──────────────────────────────────────
// Quando o backend reinicia (dev ou produção), retoma warmups que estavam ativos
async function restoreActiveWarmups() {
  try {
    const rows: any[] = await prisma.$queryRaw<any[]>`
      SELECT ws.*, wi.phone_number, wi.name as instance_name, wi.user_id
      FROM warmup_states ws
      JOIN whatsapp_instances wi ON wi.id = ws.instance_id
      WHERE ws.running = true
    `.catch(() => []);

    for (const row of rows) {
      const key = String(row.instance_id);
      if (activeWarmups.has(key)) continue;

      const now = Date.now();
      const startedAt  = Number(row.started_at);
      const msPerDay   = 24 * 60 * 60 * 1000;
      const daysSince  = Math.floor((now - startedAt) / msPerDay);
      const day        = Math.max(1, daysSince + 1);
      const lastDayAt  = startedAt + daysSince * msPerDay;
      const phase      = getPhase(day);
      const firstDelay = rand(phase.delayMinSec, phase.delayMaxSec) * 1000;

      const state: WarmupState = {
        running: true,
        instanceId: Number(row.instance_id),
        userId: Number(row.user_id),
        phone: row.phone_number,
        instanceName: row.instance_name,
        day,
        sessionSent: 0,
        sessionsToday: 0,
        totalSent: Number(row.total_sent) || 0,
        currentPhaseId: phase.id,
        lastMessage: '',
        nextMsgAt: now + firstDelay,
        startedAt,
        lastDayAt,
        timer: null,
        logs: [{ time: new Date().toLocaleTimeString('pt-BR'), msg: `Aquecimento retomado após restart — Dia ${day}`, phaseId: phase.id, type: 'info' }],
      };

      activeWarmups.set(key, state);
      state.timer = setTimeout(() => sendNextBatch(key), firstDelay);
      logger.info(`[Warmup] ♻️  Retomado para ${row.instance_name} (dia ${day}, total ${state.totalSent})`);
    }
    if (rows.length > 0) logger.info(`[Warmup] Auto-retomada: ${rows.length} warmup(s) restaurado(s)`);
  } catch (err: any) {
    logger.warn(`[Warmup] Auto-retomada falhou: ${err.message}`);
  }
}

// Executar após 3s para dar tempo do Prisma conectar
setTimeout(restoreActiveWarmups, 3000);

// ─── Loop de envio ────────────────────────────────────────────────────────────
async function sendNextBatch(key: string) {
  const state = activeWarmups.get(key);
  if (!state || !state.running) return;

  const phase = getPhase(state.day);
  state.currentPhaseId = phase.id;

  const batchSize = rand(phase.msgsMin, phase.msgsMax);
  addLog(state, `Sessão iniciada · fase ${phase.name} · ${batchSize} msgs`, phase.id, 'info');

  for (let i = 0; i < batchSize; i++) {
    if (!state.running) break;

    const msg = pickMsg(phase);
    try {
      await whatsappService.sendText(state.instanceName, state.phone, msg);
      state.sessionSent++;
      state.totalSent++;
      state.lastMessage = msg;
      addLog(state, msg, phase.id, 'sent');

      // Atualiza lastMessageAt (sem incrementar totalMessagesSent — reservado para disparos)
      await prisma.whatsAppInstance.update({
        where: { id: state.instanceId },
        data: { lastMessageAt: new Date() },
      }).catch(() => {});

      emitToUser(state.userId, 'warmup:progress', {
        instanceId: state.instanceId,
        day: state.day,
        phaseId: phase.id,
        phaseName: phase.name,
        sessionSent: state.sessionSent,
        totalSent: state.totalSent,
        message: msg,
        nextMsgAt: state.nextMsgAt,
      });

      logger.info(`[Warmup] ✅ ${state.instanceName} → ${state.phone}: "${msg}"`);
      prisma.$executeRaw`UPDATE warmup_states SET total_sent=${state.totalSent}, session_sent=${state.sessionSent}, updated_at=NOW() WHERE instance_id=${state.instanceId}`.catch(() => {});
    } catch (err: any) {
      addLog(state, `Erro: ${err.message}`, phase.id, 'error');
      logger.warn(`[Warmup] ❌ Erro: ${err.message}`);
      emitToUser(state.userId, 'warmup:error', { instanceId: state.instanceId, error: err.message });
      if (err.message?.includes('timeout') || err.message?.includes('ECONNREFUSED')) {
        await sleep(30000, state);
      }
    }

    // Delay intra-sessão (entre msgs)
    if (i < batchSize - 1 && state.running) {
      const intra = rand(phase.intraSec[0], phase.intraSec[1]) * 1000;
      state.nextMsgAt = Date.now() + intra;
      await sleep(intra, state);
    }
  }

  if (!state.running) return;

  // Verifica se deve avançar de dia (apenas após 24h desde início do dia atual)
  state.sessionsToday++;
  state.sessionSent = 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  const now2 = Date.now();
  if (now2 - state.lastDayAt >= msPerDay) {
    const diasPassados = Math.floor((now2 - state.lastDayAt) / msPerDay);
    state.day += diasPassados;
    state.lastDayAt += diasPassados * msPerDay;
    state.sessionsToday = 0;
    addLog(state, `Novo dia! Agora é o dia ${state.day} do protocolo.`, getPhase(state.day).id, 'info');
  }
  const nextPhase = getPhase(state.day);
  state.currentPhaseId = nextPhase.id;
  addLog(state, `Sessão ${state.sessionsToday} concluída. Dia ${state.day} · fase: ${nextPhase.name}`, nextPhase.id, 'info');

  // Persistir estado no banco via SQL raw
  prisma.$executeRaw`
    INSERT INTO warmup_states (instance_id, running, day, phase_id, started_at, last_day_at, sessions_today, total_sent, session_sent, updated_at)
    VALUES (${state.instanceId}, true, ${state.day}, ${state.currentPhaseId}, ${BigInt(state.startedAt)}, ${BigInt(state.lastDayAt)}, ${state.sessionsToday}, ${state.totalSent}, ${state.sessionSent}, NOW())
    ON CONFLICT (instance_id) DO UPDATE SET running=true, day=${state.day}, phase_id=${state.currentPhaseId}, started_at=${BigInt(state.startedAt)}, last_day_at=${BigInt(state.lastDayAt)}, sessions_today=${state.sessionsToday}, total_sent=${state.totalSent}, session_sent=${state.sessionSent}, updated_at=NOW()
  `.catch(() => {});

  // Delay inter-sessão (maior)
  const interDelay = rand(phase.delayMinSec, phase.delayMaxSec) * 1000;
  state.nextMsgAt = Date.now() + interDelay;

  emitToUser(state.userId, 'warmup:progress', {
    instanceId: state.instanceId,
    day: state.day,
    phaseId: nextPhase.id,
    phaseName: nextPhase.name,
    sessionSent: 0,
    totalSent: state.totalSent,
    message: '',
    nextMsgAt: state.nextMsgAt,
    waitingSecs: Math.round(interDelay / 1000),
  });

  if (state.running) {
    state.timer = setTimeout(() => sendNextBatch(key), interDelay);
  }
}

// Sleep que respeita state.running
function sleep(ms: number, state: WarmupState): Promise<void> {
  return new Promise(resolve => {
    const chunk = 500;
    let elapsed = 0;
    const tick = setInterval(() => {
      elapsed += chunk;
      if (!state.running || elapsed >= ms) {
        clearInterval(tick);
        resolve();
      }
    }, chunk);
  });
}

function addLog(
  state: WarmupState,
  msg: string,
  phaseId: number,
  type: 'sent' | 'error' | 'info'
) {
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  state.logs.push({ time, msg, phaseId, type });
  if (state.logs.length > 100) state.logs.shift(); // mantém últimas 100
}

// ─────────────────────────────────────────────────────────────────────────────
// ROTAS
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/warmup/start */
router.post('/start', async (req: AuthRequest, res: Response) => {
  const { instanceId, startDay = 1, startedAt } = req.body;
  const userId = req.user!.id;

  if (!instanceId) return res.status(400).json({ error: 'instanceId obrigatório' });

  const instId = parseInt(String(instanceId));
  const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instId } });
  if (!instance) return res.status(404).json({ error: 'Instância não encontrada' });
  if (instance.status !== 'connected') return res.status(409).json({ error: 'Instância não conectada' });
  if (!instance.phoneNumber) return res.status(400).json({ error: 'Número não disponível' });

  const key = `${instId}`;

  // Se já está rodando em memória, retorna estado atual
  if (activeWarmups.has(key)) {
    const existing = activeWarmups.get(key)!;
    return res.json({
      message: 'Warmup já em execução',
      running: existing.running,
      day: existing.day,
      phaseId: existing.currentPhaseId,
      sessionSent: existing.sessionSent,
      totalSent: existing.totalSent,
      nextMsgAt: existing.nextMsgAt,
      logs: existing.logs.slice(-20),
    });
  }

  // Verificar se há estado salvo no banco via SQL raw (independe do prisma generate)
  const savedRows: any[] = await prisma.$queryRaw<any[]>`SELECT * FROM warmup_states WHERE instance_id = ${instId} LIMIT 1`.catch(() => []);
  const saved = savedRows[0] || null;

  const now = Date.now();
  let warmupStartedAt: number;
  let resumeDay: number;
  let resumeLastDayAt: number;
  let resumeTotalSent: number;
  let resumeSessionsToday: number;

  if (saved && saved.started_at) {
    // Retomar do estado salvo — recalcula dia baseado em started_at real
    warmupStartedAt  = Number(saved.started_at);
    const msPerDay   = 24 * 60 * 60 * 1000;
    const daysSince  = Math.floor((now - warmupStartedAt) / msPerDay);
    resumeDay        = Math.max(1, daysSince + 1);
    resumeLastDayAt  = warmupStartedAt + daysSince * msPerDay;
    resumeTotalSent  = saved.total_sent ?? 0;
    resumeSessionsToday = 0; // novo dia ao retomar
    logger.info(`[Warmup] Retomando do banco: dia ${resumeDay}, totalSent ${resumeTotalSent}`);
  } else {
    // Início limpo
    warmupStartedAt     = startedAt ? parseInt(String(startedAt)) : now;
    const daysSinceStart = Math.floor((now - warmupStartedAt) / (1000 * 60 * 60 * 24));
    resumeDay           = startDay;
    resumeLastDayAt     = warmupStartedAt + daysSinceStart * 24 * 60 * 60 * 1000;
    resumeTotalSent     = 0;
    resumeSessionsToday = 0;
  }

  const phase = getPhase(resumeDay);
  const firstDelay = rand(phase.delayMinSec, phase.delayMaxSec) * 1000;

  const state: WarmupState = {
    running: true,
    instanceId: instId,
    userId,
    phone: instance.phoneNumber,
    instanceName: instance.name || `instance_${instId}`,
    day: resumeDay,
    sessionSent: 0,
    sessionsToday: resumeSessionsToday,
    totalSent: resumeTotalSent,
    currentPhaseId: phase.id,
    lastMessage: '',
    nextMsgAt: now + firstDelay,
    startedAt: warmupStartedAt,
    lastDayAt: resumeLastDayAt,
    timer: null,
    logs: [],
  };

  activeWarmups.set(key, state);
  addLog(state, `Aquecimento iniciado · Dia ${startDay} · fase ${phase.name}`, phase.id, 'info');

  // Primeira sessão após delay inicial
  state.timer = setTimeout(() => sendNextBatch(key), firstDelay);

  logger.info(`[Warmup] Iniciado para ${instance.name || 'instance_'+instId} → ${instance.phoneNumber} (dia ${startDay})`);

  return res.json({
    message: 'Warmup iniciado',
    running: true,
    day: startDay,
    phaseId: phase.id,
    phaseName: phase.name,
    nextMsgAt: state.nextMsgAt,
    startedAt: warmupStartedAt,
    firstMsgInSecs: Math.round(firstDelay / 1000),
  });
});

/** POST /api/warmup/stop */
router.post('/stop', async (req: AuthRequest, res: Response) => {
  const { instanceId } = req.body;
  const key = `${parseInt(String(instanceId))}`;
  const state = activeWarmups.get(key);

  if (!state) return res.status(404).json({ error: 'Nenhum warmup ativo' });

  state.running = false;
  if (state.timer) clearTimeout(state.timer);
  activeWarmups.delete(key);

  // Persistir estado parado no banco via SQL raw
  await prisma.$executeRaw`
    INSERT INTO warmup_states (instance_id, running, day, phase_id, started_at, last_day_at, sessions_today, total_sent, session_sent, updated_at)
    VALUES (${state.instanceId}, false, ${state.day}, ${state.currentPhaseId}, ${BigInt(state.startedAt)}, ${BigInt(state.lastDayAt)}, ${state.sessionsToday}, ${state.totalSent}, 0, NOW())
    ON CONFLICT (instance_id) DO UPDATE SET running=false, day=${state.day}, phase_id=${state.currentPhaseId}, started_at=${BigInt(state.startedAt)}, last_day_at=${BigInt(state.lastDayAt)}, sessions_today=${state.sessionsToday}, total_sent=${state.totalSent}, session_sent=0, updated_at=NOW()
  `.catch(() => {});

  logger.info(`[Warmup] Parado para instance_${instanceId} (total: ${state.totalSent})`);
  return res.json({ message: 'Warmup parado', totalSent: state.totalSent });
});

/** GET /api/warmup/status?instanceId=X — polling do frontend */
router.get('/status', async (req: AuthRequest, res: Response) => {
  const { instanceId } = req.query;

  if (instanceId) {
    const key = `${parseInt(String(instanceId))}`;
    const state = activeWarmups.get(key);
    if (!state) {
      // Buscar último estado salvo no banco via SQL raw (independe do prisma generate)
      const rows: any[] = await prisma.$queryRaw<any[]>`SELECT * FROM warmup_states WHERE instance_id = ${parseInt(key)} LIMIT 1`.catch(() => []);
      const saved = rows[0] || null;
      const now = Date.now();
      let savedDay = 1;
      if (saved?.started_at) {
        const ms = 24 * 60 * 60 * 1000;
        savedDay = Math.max(1, Math.floor((now - Number(saved.started_at)) / ms) + 1);
      }
      return res.json({
        running: false,
        day: savedDay,
        phaseId: saved?.phase_id ?? 1,
        sessionSent: 0,
        totalSent: saved?.total_sent ?? 0,
        nextMsgAt: 0,
        startedAt: saved?.started_at ? Number(saved.started_at) : null,
        logs: [],
      });
    }
    return res.json({
      running: state.running,
      day: state.day,
      phaseId: state.currentPhaseId,
      phaseName: getPhase(state.day).name,
      sessionSent: state.sessionSent,
      sessionsToday: state.sessionsToday,
      totalSent: state.totalSent,
      lastMessage: state.lastMessage,
      nextMsgAt: state.nextMsgAt,
      startedAt: state.startedAt,
      lastDayAt: state.lastDayAt,
      secsUntilNext: state.nextMsgAt > 0 ? Math.max(0, Math.round((state.nextMsgAt - Date.now()) / 1000)) : 0,
      logs: state.logs.slice(-30),
    });
  }

  // Todos os warmups ativos
  const all: any = {};
  activeWarmups.forEach((v, k) => {
    all[k] = { running: v.running, day: v.day, phaseId: v.currentPhaseId, totalSent: v.totalSent };
  });
  return res.json(all);
});

/** POST /api/warmup/reset-started-at — corrige a data de início do aquecimento */
router.post('/reset-started-at', async (req: AuthRequest, res: Response) => {
  const { instanceId, startedAt } = req.body;
  if (!instanceId) return res.status(400).json({ error: 'instanceId obrigatório' });

  const instId = parseInt(String(instanceId));
  const newStartedAt = startedAt ? parseInt(String(startedAt)) : Date.now();

  await prisma.$executeRaw`
    UPDATE warmup_states SET started_at = ${BigInt(newStartedAt)}, updated_at = NOW()
    WHERE instance_id = ${instId}
  `.catch(() => {});

  // Atualizar na memória também se estiver rodando
  const key = String(instId);
  const state = activeWarmups.get(key);
  if (state) {
    state.startedAt = newStartedAt;
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSince = Math.floor((Date.now() - newStartedAt) / msPerDay);
    state.day = Math.max(1, daysSince + 1);
    state.lastDayAt = newStartedAt + daysSince * msPerDay;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSince = Math.floor((Date.now() - newStartedAt) / msPerDay);
  const newDay = Math.max(1, daysSince + 1);

  logger.info(`[Warmup] startedAt corrigido para instance ${instId}: dia ${newDay}`);
  return res.json({ ok: true, newDay, newStartedAt, message: `Aquecimento agora está no dia ${newDay}` });
});

export default router;