import { Router } from 'express';
import axios from 'axios';
import { authenticate, AuthRequest } from '../middleware/auth';
import { WhatsAppInstance } from '../models';
import whatsappService from '../adapters/whatsapp.config';
import { io } from '../server';
import { Op } from 'sequelize';
import crypto from 'crypto';
import { registerWebhookForInstance } from '../utils/webhookStartup';
import logger from '../utils/logger';

const router = Router();

const instanceListCache = new Map<string, { data: any; hash: string; timestamp: number }>();
const CACHE_DURATION = 10000;

const planInstanceLimits: Record<string, number> = {
  'free': 0, 'basic': 1, 'pro': 3, 'enterprise': 10
};

function generateHash(data: any): string {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
}

const getEvolutionUrl = () =>
  (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081').replace('localhost', '127.0.0.1');
const getApiKey = () => process.env.EVOLUTION_API_KEY || '';

function invalidateCache(userId: number) {
  Array.from(instanceListCache.keys()).forEach(k => {
    if (k.startsWith(`${userId}:`)) instanceListCache.delete(k);
  });
}

// ============================================
// GET / — listar instâncias
// ============================================
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const includeInactive = req.query.all === 'true';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;

    const cacheKey = `${userId}:${includeInactive}:${page}:${limit}`;
    const cached = instanceListCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return res.json(cached.data);
    }

    const where: any = { userId };
    if (!includeInactive) where.isActive = true;

    const { count, rows } = await WhatsAppInstance.findAndCountAll({
      where, offset, limit, order: [['createdAt', 'DESC']]
    });

    const response = {
      data: rows,
      pagination: { total: count, page, limit, pages: Math.ceil(count / limit) }
    };

    instanceListCache.set(cacheKey, { data: response, hash: generateHash(response), timestamp: Date.now() });
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /:id — detalhe
// ============================================
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const instance = await WhatsAppInstance.findByPk(Number(req.params.id));
    if (!instance) return res.status(404).json({ error: 'Instância não encontrada' });

    res.json({
      id: instance.id,
      name: instance.name,
      phoneNumber: instance.phoneNumber,
      status: instance.status,
      qrCode: instance.qrCode,
      connected: instance.status === 'connected',
      connectedAt: instance.connectedAt,
      createdAt: instance.createdAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ============================================
// GET /:id/check-status — verifica status direto na Evolution
// Usado pelo frontend para polling após escanear QR
// ============================================
router.get('/:id/check-status', authenticate, async (req: AuthRequest, res) => {
  try {
    const instanceId = Number(req.params.id);
    const instance = await WhatsAppInstance.findByPk(instanceId);
    if (!instance) return res.status(404).json({ error: 'Instância não encontrada' });

    // Se já está conectada no banco, retorna direto
    if (instance.status === 'connected') {
      return res.json({ status: 'connected', phoneNumber: instance.phoneNumber });
    }

    // Verifica direto na Evolution API
    try {
      const stateRes = await axios.get(
        `${getEvolutionUrl()}/instance/connectionState/instance_${instanceId}`,
        { headers: { apikey: getApiKey() }, timeout: 10000 }
      );
      const state = stateRes.data?.instance?.state || stateRes.data?.state;

      if (state === 'open') {
        // Conectou! Busca número do owner
        let phoneNumber = instance.phoneNumber;
        try {
          const infoRes = await axios.get(
            `${getEvolutionUrl()}/instance/fetchInstances`,
            { headers: { apikey: getApiKey() }, timeout: 10000 }
          );
          const list = infoRes.data?.value || infoRes.data || [];
          const found = list.find((i: any) => i.instance?.instanceName === `instance_${instanceId}`);
          const owner = found?.instance?.owner;
          if (owner) phoneNumber = owner.replace('@s.whatsapp.net', '').replace('@c.us', '');
        } catch { /* ignora */ }

        // Atualiza banco
        await instance.update({ status: 'connected', connectedAt: new Date(), qrCode: null, ...(phoneNumber ? { phoneNumber } : {}) });

        // Emite via socket para atualizar outras abas
        const { io } = require('../server');
        const payload = { instanceId, phoneNumber, status: 'connected' };
        io.to(`user:${instance.userId}`).emit('whatsapp_connected', payload);
        io.to(`user-${instance.userId}`).emit('whatsapp_connected', payload);

        logger.info(`✅ [CHECK-STATUS] instance_${instanceId} conectada via polling (${phoneNumber})`);
        return res.json({ status: 'connected', phoneNumber });
      }

      return res.json({ status: state || 'connecting' });
    } catch {
      return res.json({ status: instance.status });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /:id/qr — buscar QR code
// ============================================
router.get('/:id/qr', authenticate, async (req: AuthRequest, res) => {
  try {
    const instanceId = Number(req.params.id);
    const instance = await WhatsAppInstance.findByPk(instanceId);
    if (!instance) return res.status(404).json({ error: 'Instância não encontrada' });

    if (instance.status === 'connected') {
      return res.json({ qrCode: null, status: 'connected', message: 'WhatsApp já conectado' });
    }

    let qrCode = instance.qrCode || null;
    if (!qrCode) {
      try {
        const qrRes = await axios.get(
          `${getEvolutionUrl()}/instance/connect/instance_${instanceId}`,
          { headers: { apikey: getApiKey() }, timeout: 15000 }
        );
        const data = qrRes.data;
        qrCode = data?.base64 || data?.qrcode?.base64 || null;
        if (qrCode && !qrCode.startsWith('data:image')) qrCode = `data:image/png;base64,${qrCode}`;
        if (qrCode && qrCode.length > 500) {
          await instance.update({ qrCode });
        }
      } catch { /* sem QR ainda */ }
    }

    if (qrCode) return res.json({ qrCode, status: 'pending' });
    return res.json({ qrCode: null, status: 'awaiting', retryAfter: 2 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST / — criar instância
// ============================================
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { name, accountAge } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const instance = await WhatsAppInstance.create({
      userId, name, status: 'disconnected', isActive: true, accountAge: accountAge || 30,
    });

    invalidateCache(userId);
    res.status(201).json(instance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /:id/connect — conectar e obter QR
// ============================================
router.post('/:id/connect', authenticate, async (req: AuthRequest, res) => {
  const instanceId = Number(req.params.id);
  try {
    const instance = await WhatsAppInstance.findByPk(instanceId);
    if (!instance) return res.status(404).json({ error: 'Instância não encontrada' });

    const evolutionName = `instance_${instanceId}`;
    const evolutionUrl = getEvolutionUrl();
    const apiKey = getApiKey();

    // Verifica se já está conectada na Evolution
    try {
      const stateRes = await axios.get(
        `${evolutionUrl}/instance/connectionState/${evolutionName}`,
        { headers: { apikey: apiKey }, timeout: 10000 }
      );
      const state = stateRes.data?.instance?.state || stateRes.data?.state;
      if (state === 'open') {
        await instance.update({ status: 'connected', qrCode: null });
        // Garante que webhook está registrado
        await registerWebhookForInstance(instanceId);
        return res.json({ success: true, qrCode: null, status: 'connected', message: 'WhatsApp já conectado' });
      }
    } catch { /* não existe ainda */ }

    // Cria instância na Evolution
    try {
      await axios.post(
        `${evolutionUrl}/instance/create`,
        { instanceName: evolutionName, qrcode: true, integration: 'WHATSAPP-BAILEYS' },
        { headers: { apikey: apiKey }, timeout: 15000 }
      );
      logger.info(`[CONNECT] Instância ${evolutionName} criada`);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 409 || status === 400 || status === 403) {
        logger.info(`[CONNECT] Instância ${evolutionName} já existe (${status})`);
      } else throw err;
    }

    // Registra webhook imediatamente
    await registerWebhookForInstance(instanceId);

    // Aguarda Evolution processar
    await new Promise(r => setTimeout(r, 2000));

    // Busca QR
    let qrBase64: string | null = null;
    try {
      const qrRes = await axios.get(
        `${evolutionUrl}/instance/connect/${evolutionName}`,
        { headers: { apikey: apiKey }, timeout: 15000 }
      );
      const data = qrRes.data;
      qrBase64 = data?.base64 || data?.qrcode?.base64 || null;
      if (qrBase64 && !qrBase64.startsWith('data:image')) {
        qrBase64 = `data:image/png;base64,${qrBase64}`;
      }
    } catch (err: any) {
      logger.warn(`[CONNECT] Erro ao buscar QR: ${err.message}`);
    }

    if (qrBase64 && qrBase64.length > 500) {
      await instance.update({ qrCode: qrBase64, status: 'connecting' });
      return res.json({ success: true, qrCode: qrBase64, message: 'QR Code obtido. Escaneie com seu WhatsApp' });
    }

    // QR ainda não disponível
    await instance.update({ status: 'connecting' });
    return res.status(202).json({
      success: false, qrCode: null, status: 'connecting',
      message: 'Aguardando QR Code. Tente novamente em 3 segundos.', retryAfter: 3
    });

  } catch (error: any) {
    logger.error(`[CONNECT] Erro: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DELETE /:id — remover instância
// ============================================
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const instanceId = req.params.id;
    const userId = req.user!.id;
    const instance = await WhatsAppInstance.findByPk(instanceId);
    if (!instance) return res.status(404).json({ error: 'Instância não encontrada' });

    const evolutionUrl = getEvolutionUrl();
    const apiKey = getApiKey();
    const names = [`instance_${instanceId}`, instance.name].filter(Boolean);

    for (const eName of names) {
      try {
        await axios.delete(`${evolutionUrl}/instance/logout/${eName}`, { headers: { apikey: apiKey }, timeout: 10000 });
      } catch { /* ignora */ }
      try {
        await axios.delete(`${evolutionUrl}/instance/delete/${eName}`, { headers: { apikey: apiKey }, timeout: 10000 });
        break;
      } catch { /* ignora */ }
    }

    try { await whatsappService.disconnect(Number(instanceId)); } catch { /* ignora */ }

    await instance.update({ isActive: false, status: 'disconnected', qrCode: null });
    invalidateCache(userId);

    io.to(`user:${userId}`).emit('whatsapp_disconnected', { instanceId: instance.id, status: 'disconnected' });
    io.to(`user-${userId}`).emit('whatsapp_disconnected', { instanceId: instance.id, status: 'disconnected' });

    res.json({ message: 'Instância removida com sucesso' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /cleanup/validate-plan-limit
// ============================================
router.post('/cleanup/validate-plan-limit', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const instanceLimit = planInstanceLimits[req.user!.plan] || 0;
    const active = await WhatsAppInstance.findAll({ where: { userId, isActive: true }, order: [['createdAt', 'ASC']] });
    if (active.length > instanceLimit) {
      const toDelete = active.slice(instanceLimit);
      await WhatsAppInstance.destroy({ where: { id: { [Op.in]: toDelete.map(i => i.id) } } });
      invalidateCache(userId);
    }
    const final = await WhatsAppInstance.count({ where: { userId, isActive: true } });
    res.json({ success: true, plan: req.user!.plan, limit: instanceLimit, currentInstances: final });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DELETE /debug/cleanup-inactive
// ============================================
router.delete('/debug/cleanup-inactive', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const deleted = await WhatsAppInstance.destroy({ where: { userId, isActive: false } });
    res.json({ message: `${deleted} instâncias inativas deletadas`, deletedCount: deleted });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DELETE /debug/force-cleanup-all
// ============================================
router.delete('/debug/force-cleanup-all', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const deleted = await WhatsAppInstance.destroy({ where: { userId } });
    invalidateCache(userId);
    res.json({ message: `${deleted} instâncias deletadas`, deletedCount: deleted });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;