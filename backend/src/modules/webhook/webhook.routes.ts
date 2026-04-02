import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { saveGroupsFromWebhook, syncGroupsBackground } from '../../services/groups.service';
import { emitToUser } from '../../sockets/socket.server';
import whatsappService from '../../services/whatsapp.service';
import logger from '../../utils/logger';

const router = Router();

async function findInstance(instanceName: string) {
  if (!instanceName) return null;

  // Tenta por nome direto na tabela
  let inst = await prisma.whatsAppInstance.findFirst({ where: { name: instanceName, isActive: true } });
  if (inst) return inst;

  // Tenta por padrão instance_ID
  const match = instanceName.match(/^instance_(\d+)$/);
  if (match) {
    inst = await prisma.whatsAppInstance.findFirst({ where: { id: parseInt(match[1]), isActive: true } });
    if (inst) return inst;
  }

  return null;
}

/** POST /api/webhook/evolution */
// v2 com byEvents:true manda para /evolution/EVENT_NAME — captura ambos
router.post('/evolution/:event?', async (req: Request, res: Response) => {
  // Responde IMEDIATAMENTE — Evolution tem timeout curto
  res.json({ received: true });

  // Verifica apikey da Evolution se configurada
  const evolutionKey = process.env.EVOLUTION_API_KEY;
  if (evolutionKey) {
    const bodyKey = req.body?.apikey || req.headers['apikey'];
    if (bodyKey && bodyKey !== evolutionKey) {
      logger.warn(`[Webhook] Requisição com apikey inválida — ignorada`);
      return;
    }
  }

  try {
    const body = req.body;
    // v2 byEvents: event vem na URL (/evolution/QRCODE_UPDATED) ou no body
    const eventFromParam = (req.params as any).event || '';
    const event = body?.event || body?.type || eventFromParam || '';
    const instanceName = body?.instance || body?.instanceName ||
                         body?.data?.instance?.instanceName ||
                         body?.data?.instanceName || '';

    // Log apenas eventos relevantes — silencia messages.upsert para não spammar
    const silentEvents = ['messages.upsert', 'messages_upsert', 'MESSAGES_UPSERT', 'messages.update', 'message.upsert'];
    const evtNorm = event.toLowerCase().replace(/_/g, '.');
    if (!silentEvents.some(s => s.toLowerCase() === evtNorm || evtNorm.includes('message'))) {
      logger.info(`[Webhook] ▶ event="${event}" instance="${instanceName}" keys=${Object.keys(body||{}).join(',')}`);
    }
    if (!event || !instanceName) {
      // v2 pode mandar formato diferente — loga body completo
      logger.warn(`[Webhook] Payload não mapeado: ${JSON.stringify(body).substring(0, 500)}`);
      return;
    }

    const instance = await findInstance(instanceName);
    if (!instance) {
      logger.warn(`[Webhook] Instância não encontrada: ${instanceName}`);
      return;
    }

    // v2: eventos em lowercase com ponto (connection.update, qrcode.updated)
    // v1: eventos em uppercase com underscore (CONNECTION_UPDATE, QRCODE_UPDATED)
    const evt = event.toUpperCase().replace(/\./g, '_');

    // ─── CONNECTION_UPDATE ────────────────────────────────────────────────────
    if (evt === 'CONNECTION_UPDATE') {
      const state = body?.data?.state || body?.data?.status || body?.state || '';
      logger.info(`[Webhook] CONNECTION_UPDATE: ${instanceName} → "${state}" | data=${JSON.stringify(body?.data||{}).substring(0,150)}`);

      if (state === 'open') {
        // Tenta extrair número de várias posições do payload
        const ownerJid =
          body?.data?.instance?.owner ||
          body?.data?.owner ||
          body?.owner ||
          body?.sender ||
          body?.data?.sender;
        let phoneNumber = ownerJid
          ? ownerJid.replace('@s.whatsapp.net', '').replace('@c.us', '')
          : instance.phoneNumber;

        // Se não veio no payload, busca na Evolution
        if (!phoneNumber) {
          try {
            const all = await whatsappService.fetchInstances();
            const found = all.find((i: any) => (i.instance?.instanceName || i.instanceName) === instanceName);
            const owner = found?.instance?.owner || found?.owner;
            if (owner) phoneNumber = owner.replace('@s.whatsapp.net', '').replace('@c.us', '');
          } catch { /* ignora */ }
        }

        await prisma.whatsAppInstance.update({
          where: { id: instance.id },
          data: {
            status: 'connected',
            qrCode: null,
            ...(instance.connectedAt ? {} : { connectedAt: new Date() }),
            ...(phoneNumber ? { phoneNumber } : {}),
          },
        });

        logger.info(`✅ [Webhook] ${instanceName} CONECTADA${phoneNumber ? ` (${phoneNumber})` : ''}`);

        const payload = { instanceId: instance.id, instanceName, phoneNumber, status: 'connected' };
        emitToUser(instance.userId, 'whatsapp_connected', payload);

        // Dispara sync imediato (5s) + segundo sync após 60s para pegar grupos que demoram
        setTimeout(() => {
          syncGroupsBackground(instance.id).catch(() => {});
        }, 5000);
        setTimeout(() => {
          syncGroupsBackground(instance.id).catch(() => {});
        }, 60000);
        logger.info(`[Webhook] Sync de grupos agendado em 5s e 60s para ${instanceName}`);

      } else if (state === 'close') {
        if (instance.status === 'connected') {
          await prisma.whatsAppInstance.update({ where: { id: instance.id }, data: { status: 'disconnected', qrCode: null } });
          logger.warn(`🔴 [Webhook] ${instanceName} DESCONECTADA`);
          emitToUser(instance.userId, 'whatsapp_disconnected', { instanceId: instance.id, status: 'disconnected' });
        }
      }
    }

    // ─── QRCODE_UPDATED ───────────────────────────────────────────────────────
    if (evt === 'QRCODE_UPDATED' || evt === 'QRCODE_UPDATE') {
      const qrCode =
        body?.data?.qrcode?.base64 ||
        body?.data?.base64 ||
        body?.qrcode?.base64 ||
        body?.base64;

      if (qrCode && qrCode.length > 500) {
        const normalized = qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`;
        await prisma.whatsAppInstance.update({ where: { id: instance.id }, data: { qrCode: normalized, status: 'connecting' } });
        logger.info(`📱 [Webhook] QR atualizado para ${instanceName}`);
        emitToUser(instance.userId, 'qr_code', { instanceId: instance.id, qrCode: normalized });
      }
    }

    // ─── GROUPS_UPSERT — grupos chegam automaticamente na conexão ─────────────
    if (evt === 'GROUPS_UPSERT' || evt === 'GROUP_UPSERT' || evt === 'GROUP.UPSERT') {
      const raw = body?.data || body?.groups || [];
      const groupList = Array.isArray(raw) ? raw : [raw];
      if (groupList.length > 0) {
        logger.info(`[Webhook] GROUPS_UPSERT: ${groupList.length} grupos para ${instanceName}`);
        await saveGroupsFromWebhook(instance.id, groupList);
        emitToUser(instance.userId, 'groups_updated', { instanceId: instance.id, total: groupList.length });
      }
    }

    // ─── GROUP_UPDATE ─────────────────────────────────────────────────────────
    if (evt === 'GROUP_UPDATE' || evt === 'GROUP.UPDATE') {
      const raw = body?.data;
      if (raw) await saveGroupsFromWebhook(instance.id, Array.isArray(raw) ? raw : [raw]);
    }

    // ─── MESSAGES_UPSERT — captura nome do grupo via mensagens recebidas ──────
    // findChats não retorna subject; mas mensagens trazem pushName/subject do grupo
    if (evt === 'MESSAGES_UPSERT' || evt === 'MESSAGES.UPSERT') {
      try {
        const msgs = body?.data || body?.messages || body || [];
        const list = Array.isArray(msgs) ? msgs : [msgs];
        for (const msg of list) {
          const jid: string = msg?.key?.remoteJid || msg?.remoteJid || '';
          if (!jid.includes('@g.us')) continue;

          // Tenta pegar o nome do grupo de diferentes campos do payload
          const groupName = msg?.pushName || msg?.subject || msg?.groupName ||
                            msg?.message?.conversation?.substring(0, 50) || null;

          if (groupName && groupName.length > 1) {
            await prisma.whatsAppGroup.updateMany({
              where: { instanceId: instance.id, groupId: jid, name: { startsWith: 'Grupo ' } },
              data: { name: groupName },
            });
          }
        }
      } catch { /* não crítico */ }
    }

  } catch (err: any) {
    logger.error(`[Webhook] Erro: ${err.message}`);
  }
});

/** GET /api/webhook/evolution/sync-number/:instanceName */
router.get('/evolution/sync-number/:instanceName', async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const state = await whatsappService.getInstanceState(instanceName);
    const instances = await whatsappService.fetchInstances();
    const found = instances.find((i: any) => (i.instance?.instanceName || i.instanceName) === instanceName);
    const owner = found?.instance?.owner || found?.owner;
    const phoneNumber = owner ? owner.replace('@s.whatsapp.net', '').replace('@c.us', '') : null;

    const instance = await findInstance(instanceName);
    if (instance && phoneNumber) {
      await prisma.whatsAppInstance.update({ where: { id: instance.id }, data: { phoneNumber } });
    }

    return res.json({ instanceName, phoneNumber, state });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


export default router;