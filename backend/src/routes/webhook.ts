import { Router } from 'express';
import { User, Payment, WhatsAppInstance } from '../models';
import { io } from '../server';
import logger from '../utils/logger';
import axios from 'axios';

const router = Router();

// ============================================
// WEBHOOK PAGAMENTO (Diggion)
// ============================================
router.post('/diggion', async (req, res) => {
  try {
    const { event, customer_email, amount, transaction_id, metadata } = req.body;
    if (event === 'payment.approved') {
      const user = await User.findOne({ where: { email: customer_email } });
      if (user) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (metadata?.duration || 30));
        await user.update({ plan: metadata?.plan, planExpiresAt: expiresAt });
        await Payment.create({
          userId: user.id,
          diggionTransactionId: transaction_id,
          amount,
          status: 'approved',
          plan: metadata?.plan,
          planDuration: metadata?.duration,
          expiresAt
        });
      }
    }
    res.json({ received: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HELPER: busca instância pelo nome da Evolution
// ============================================
async function findInstanceByEvolutionName(instanceName: string): Promise<any | null> {
  if (!instanceName) return null;

  // Tenta por name direto
  let instance = await WhatsAppInstance.findOne({ where: { name: instanceName, isActive: true } });
  if (instance) return instance;

  // Tenta por padrão instance_ID
  const match = instanceName.match(/^instance_(\d+)$/);
  if (match) {
    instance = await WhatsAppInstance.findOne({ where: { id: parseInt(match[1]), isActive: true } });
    if (instance) return instance;
  }

  // Fallback: única instância ativa
  const all = await WhatsAppInstance.findAll({ where: { isActive: true }, limit: 1 });
  return all[0] || null;
}

// ============================================
// WEBHOOK EVOLUTION API — eventos do WhatsApp
// ============================================
router.post('/evolution', async (req, res) => {
  try {
    res.json({ received: true }); // responde rápido

    const body = req.body;
    const event = body?.event || body?.type;
    const instanceName = body?.instance || body?.instanceName || body?.data?.instance?.instanceName;

    if (!event || !instanceName) return;

    logger.info(`[WEBHOOK] Evento: ${event} | Instância: ${instanceName}`);

    const instance = await findInstanceByEvolutionName(instanceName);
    if (!instance) {
      logger.warn(`[WEBHOOK] Instância não encontrada: ${instanceName}`);
      return;
    }

    // ----------------------------------------
    // CONNECTION_UPDATE
    // ----------------------------------------
    if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
      const state = body?.data?.state || body?.state;
      logger.info(`[WEBHOOK] CONNECTION_UPDATE: ${instanceName} → ${state}`);

      if (state === 'open') {
        const ownerJid =
          body?.data?.instance?.owner ||
          body?.data?.owner ||
          body?.instance?.owner ||
          body?.owner;
        const phoneNumber = ownerJid
          ? ownerJid.replace('@s.whatsapp.net', '').replace('@c.us', '')
          : instance.phoneNumber;

        await instance.update({
          status: 'connected',
          connectedAt: new Date(),
          qrCode: null,
          ...(phoneNumber ? { phoneNumber } : {})
        });

        logger.info(`✅ [WEBHOOK] ${instanceName} CONECTADA${phoneNumber ? ` (${phoneNumber})` : ''}`);

        // Emite para o frontend via Socket.IO
        const payload = { instanceId: instance.id, instanceName, phoneNumber, status: 'connected' };
        io.to(`user:${instance.userId}`).emit('whatsapp_connected', payload);
        io.to(`user-${instance.userId}`).emit('whatsapp_connected', payload);

      } else if (state === 'close' || state === 'connecting') {
        if (instance.status === 'connected') {
          await instance.update({ status: 'disconnected', qrCode: null });
          logger.warn(`🔴 [WEBHOOK] ${instanceName} DESCONECTADA`);

          const payload = { instanceId: instance.id, status: 'disconnected' };
          io.to(`user:${instance.userId}`).emit('whatsapp_disconnected', payload);
          io.to(`user-${instance.userId}`).emit('whatsapp_disconnected', payload);
        }
      }
    }

    // ----------------------------------------
    // QRCODE_UPDATED
    // ----------------------------------------
    if (event === 'qrcode.updated' || event === 'QRCODE_UPDATED') {
      const qrCode =
        body?.data?.qrcode?.base64 ||
        body?.data?.base64 ||
        body?.qrcode?.base64 ||
        body?.base64;

      if (qrCode && qrCode.length > 500) {
        const normalized = qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`;
        await instance.update({ qrCode: normalized, status: 'connecting' });
        logger.info(`📱 [WEBHOOK] QR Code atualizado para ${instanceName}`);

        const payload = { instanceId: instance.id, qrCode: normalized };
        io.to(`user:${instance.userId}`).emit('qr_code', payload);
        io.to(`user-${instance.userId}`).emit('qr_code', payload);
      }
    }

  } catch (error: any) {
    logger.error(`[WEBHOOK] Erro: ${error.message}`);
  }
});

// ============================================
// SYNC NUMBER — força sincronização do número
// ============================================
router.get('/evolution/sync-number/:instanceName', async (req, res) => {
  try {
    const { instanceName } = req.params;
    const evolutionUrl = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081').replace('localhost', '127.0.0.1');
    const apiKey = process.env.EVOLUTION_API_KEY || '';

    const response = await axios.get(
      `${evolutionUrl}/instance/fetchInstances`,
      { headers: { apikey: apiKey }, timeout: 15000 }
    );

    const list: any[] = response.data?.value || response.data || [];
    let phoneNumber: string | null = null;
    let foundInstance: any = null;

    for (const item of list) {
      const inst = item.instance || item;
      if (inst.instanceName === instanceName) {
        foundInstance = inst;
        const owner = inst.owner || inst.ownerJid;
        if (owner) phoneNumber = owner.replace('@s.whatsapp.net', '').replace('@c.us', '');
        break;
      }
    }

    if (!foundInstance) {
      return res.status(404).json({ error: `Instância ${instanceName} não encontrada na Evolution` });
    }

    // Atualiza banco
    const dbInstance = await findInstanceByEvolutionName(instanceName);
    if (dbInstance && phoneNumber) {
      await dbInstance.update({ phoneNumber, status: foundInstance.status === 'open' ? 'connected' : dbInstance.status });
    }

    res.json({ phoneNumber, instanceName, evolutionInstanceName: instanceName, status: foundInstance.status });
  } catch (error: any) {
    logger.error(`[SYNC-NUMBER] Erro: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;