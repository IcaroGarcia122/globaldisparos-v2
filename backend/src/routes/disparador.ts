/**
 * ✨ ROTA DE DISPARADOR (FASE 2) - Endpoints para campanha de mensagens em massa
 * 
 * POST   /api/disparador/iniciar      - Inicia uma nova campanha de disparo
 * POST   /api/disparador/enviar-xlsx  - Dispara para números de arquivo XLSX
 * GET    /api/disparador/:id          - Obtém status da campanha
 * POST   /api/disparador/:id/pausar    - Pausa a campanha
 * POST   /api/disparador/:id/retomar   - Retoma a campanha pausada
 * POST   /api/disparador/:id/parar     - Para a campanha
 * GET    /api/disparador/:id/metricas  - Obtém métricas em tempo real
 */

import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Campaign, Message, WhatsAppInstance } from '../models';
import campaignService from '../services/campaignService';
import EvolutionService from '../services/EvolutionService';
import { io as socketIO } from '../server';
import logger from '../utils/logger';
import multer from 'multer';
import XLSX from 'xlsx';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/disparador/iniciar
 * Inicia uma campanha de disparo
 * 
 * Body:
 * {
 *   "instanceId": 1,
 *   "groupIds": ["...@g.us"],
 *   "message": "Olá {nome}, tudo bem? Seu número é {numero}",
 *   "interval": 3000,
 *   "useAntibanVariations": true,
 *   "useAntibanDelays": true
 * }
 */
router.post('/iniciar', authenticate, async (req: AuthRequest, res) => {
  try {
    const { instanceId, groupIds, message, interval = 3000, campaignName } = req.body;
    const userId = req.user!.id;

    // Validações
    if (!instanceId) {
      return res.status(400).json({ error: 'instanceId é obrigatório' });
    }

    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
      return res.status(400).json({ error: 'Selecione pelo menos um grupo' });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    if (interval < 2000 || interval > 30000) {
      return res.status(400).json({ error: 'Intervalo deve estar entre 2-30 segundos' });
    }

    // Verificar se instância pertence ao usuário
    const instance = await WhatsAppInstance.findByPk(instanceId);
    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    if (instance.userId !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado a esta instância' });
    }

    // Verificar se instância está conectada
    if (instance.status !== 'connected') {
      return res.status(409).json({ error: 'Instância WhatsApp não está conectada' });
    }

    logger.info(`🚀 [DISPARADOR] Iniciando campanha para ${groupIds.length} grupos`);

    // Coletar todos os contatos dos grupos
    const allContacts = new Map<string, { name?: string; number: string }>();

    for (const groupId of groupIds) {
      try {
        logger.debug(`📋 Obtendo participantes do grupo ${groupId}...`);
        
        const participants = await EvolutionService.getGroupParticipants(
          instance.name,
          groupId
        );

        for (const participant of participants) {
          // Usar número como chave para evitar duplicatas
          const number = participant.number.replace(/\D/g, '');
          if (number && !allContacts.has(number)) {
            allContacts.set(number, {
              name: participant.name,
              number
            });
          }
        }

        logger.info(`✅ ${participants.length} participantes do grupo ${groupId}`);
      } catch (error: any) {
        logger.warn(`⚠️  Erro ao obter grupo ${groupId}: ${error.message}`);
      }
    }

    if (allContacts.size === 0) {
      return res.status(400).json({ error: 'Nenhum contato encontrado nos grupos selecionados' });
    }

    const contacts = Array.from(allContacts.values());
    
    logger.info(`📊 Total de contatos únicos: ${contacts.length}`);

    // Criar campanha no banco
    const campaign = await Campaign.create({
      userId: Number(userId),
      instanceId: Number(instanceId),
      name: campaignName || `Campanha de ${new Date().toLocaleString('pt-BR')}`,
      message,
      totalContacts: contacts.length,
      messagesScheduled: contacts.length,
      status: 'running',
      startedAt: new Date()
    } as any);

    logger.info(`✅ Campanha criada: ID ${campaign.id}`);

    // Responder ao cliente imediatamente
    res.status(201).json({
      campaignId: campaign.id,
      totalContacts: contacts.length,
      message: `Campanha iniciada para ${contacts.length} contatos`,
      estimatedDuration: (contacts.length * interval) / 1000 + 's'
    });

    // =====================================
    // DISPARAR EM BACKGROUND (assíncrono)
    // =====================================
    
    (async () => {
      const startTime = Date.now();
      let sent = 0;
      let failed = 0;

      try {
        const results = await EvolutionService.sendBulkMessages(
          instance.name,
          contacts,
          message,
          {
            interval,
            onProgress: async (progress) => {
              sent = progress.current - failed;
              if (!progress.success) {
                failed++;
              }

              const percentage = (progress.current / contacts.length) * 100;
              const elapsedSeconds = (Date.now() - startTime) / 1000;
              const estimatedTotalSeconds = (contacts.length * interval) / 1000;
              const remainingSeconds = Math.max(0, estimatedTotalSeconds - elapsedSeconds);

              // Atualizar status da campanha
              await campaign.update({
                messagesSent: sent,
                messagesFailed: failed
              });

              // Emitir via Socket.IO para o frontend em tempo real
              if (socketIO) {
                socketIO
                  .to(`campaign:${campaign.id}`)
                  .to(`user:${userId}`)
                  .emit('campanha:progresso', {
                    campaignId: campaign.id,
                    sent,
                    failed,
                    remaining: contacts.length - sent - failed,
                    percentual: percentage.toFixed(2),
                    contacto: progress.contact,
                    elapsedSeconds: Math.round(elapsedSeconds),
                    remainingSeconds: Math.round(remainingSeconds),
                    estimatedTotal: Math.round(estimatedTotalSeconds),
                    velocidade: (sent / elapsedSeconds).toFixed(2) + ' msgs/seg'
                  });
              }

              logger.debug(`⏳ [${progress.current}/${contacts.length}] ${progress.contact.number} - ${progress.success ? '✅' : '❌'}`);
            }
          }
        );

        // Finalizar campanha
        await campaign.update({
          status: 'completed',
          completedAt: new Date(),
          messagesSent: sent,
          messagesFailed: failed
        });

        logger.info(`✅ Campanha ${campaign.id} finalizada: ${sent} enviadas, ${failed} erros`);

        // Notificar via Socket.IO
        if (socketIO) {
          socketIO
            .to(`campaign:${campaign.id}`)
            .to(`user:${userId}`)
            .emit('campanha:concluida', {
              campaignId: campaign.id,
              totalSent: sent,
              totalFailed: failed,
              successRate: ((sent / contacts.length) * 100).toFixed(2) + '%',
              duration: (Date.now() - startTime) / 1000 + 's'
            });
        }

      } catch (error: any) {
        logger.error(`❌ Erro durante campanha ${campaign.id}:`, error);

        await campaign.update({
          status: 'cancelled',
          completedAt: new Date()
        });

        // Notificar erro via Socket.IO
        if (socketIO) {
          socketIO
            .to(`campaign:${campaign.id}`)
            .to(`user:${userId}`)
            .emit('campanha:erro', {
              campaignId: campaign.id,
              error: error.message
            });
        }
      }
    })();

  } catch (error: any) {
    logger.error('❌ Erro ao iniciar disparo:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/disparador/enviar-xlsx
 * Dispara mensagens para números em arquivo XLSX
 * 
 * FormData:
 * - file: arquivo XLSX (coluna 'numero' ou 'phone')
 * - instanceId: ID da instância
 * - message: mensagem a enviar (pode usar {numero}, {nome})
 * - interval: delay entre mensagens (default: 3000ms)
 */
router.post('/enviar-xlsx', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const { instanceId, message, interval = 3000 } = req.body;
    const userId = req.user!.id;
    const socketId = req.headers['x-socket-id'] as string;

    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo XLSX é obrigatório' });
    }

    if (!instanceId) {
      return res.status(400).json({ error: 'instanceId é obrigatório' });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    // Verificar se instância pertence ao usuário
    const instance = await WhatsAppInstance.findByPk(instanceId);
    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    if (instance.userId !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (instance.status !== 'connected') {
      return res.status(409).json({ error: 'Instância WhatsApp não está conectada' });
    }

    // Parsear XLSX
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    // Extrair números
    const numeros: string[] = rows
      .map(r => {
        const numero = r.numero || r.phone || r.telefone || r.whatsapp || Object.values(r)[0];
        return String(numero).replace(/\D/g, '');
      })
      .filter(n => n.length >= 10);

    if (numeros.length === 0) {
      return res.status(400).json({ error: 'Nenhum número válido encontrado no arquivo' });
    }

    logger.info(`📤 [XLSX DISPATCH] Iniciando disparo para ${numeros.length} números`);

    // Criar campanha
    const campaign = await Campaign.create({
      userId: Number(userId),
      instanceId: Number(instanceId),
      name: `Disparo via XLSX - ${new Date().toLocaleString('pt-BR')}`,
      message,
      totalContacts: numeros.length,
      messagesScheduled: numeros.length,
      status: 'running',
      startedAt: new Date()
    } as any);

    // Responder ao cliente
    res.status(201).json({
      campaignId: campaign.id,
      totalContacts: numeros.length,
      message: `Disparo iniciado para ${numeros.length} contatos`
    });

    // =====================================
    // DISPARAR EM BACKGROUND (assíncrono)
    // =====================================
    
    (async () => {
      const startTime = Date.now();
      let sent = 0;
      let failed = 0;

      try {
        for (let i = 0; i < numeros.length; i++) {
          const numero = numeros[i];

          try {
            await EvolutionService.sendMessage(
              instance.name,
              numero,
              message.replace(/{numero}/g, numero).replace(/{nome}/g, 'Usuário')
            );
            sent++;
          } catch (err) {
            failed++;
          }

          // Emitir progresso
          const percentage = Math.round(((sent + failed) / numeros.length) * 100);
          if (socketIO && socketId) {
            socketIO.to(socketId).emit('dispatch_progress', {
              sent,
              errors: failed,
              total: numeros.length,
              percentage,
              currentNumber: numero,
              status: (sent + failed) === numeros.length ? 'done' : 'sending'
            });
          }

          // Delay anti-ban
          if (i < numeros.length - 1) {
            await new Promise(r => setTimeout(r, parseInt(interval) || 3000));
          }
        }

        // Finalizar campanha
        await campaign.update({
          status: 'completed',
          completedAt: new Date(),
          messagesSent: sent,
          messagesFailed: failed
        });

        logger.info(`✅ Campanha XLSX ${campaign.id} finalizada: ${sent} enviadas, ${failed} erros`);

      } catch (error: any) {
        logger.error(`❌ Erro na campanha XLSX:`, error);
        await campaign.update({ status: 'cancelled', completedAt: new Date() });
      }
    })();

  } catch (error: any) {
    logger.error('❌ Erro ao processar XLSX:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/disparador/:id
 * Obter status detalhado da campanha
 */
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const campaignId = Number(req.params.id);
    const userId = req.user!.id;

    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    // Verificar permissão
    if (campaign.userId !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Contar mensagens por status
    const messages = await Message.findAll({
      where: { campaignId },
      attributes: ['status'],
      raw: true
    });

    const statusCount = {
      sent: messages.filter(m => m.status === 'sent').length,
      delivered: messages.filter(m => m.status === 'delivered').length,
      read: messages.filter(m => m.status === 'read').length,
      failed: messages.filter(m => m.status === 'failed').length
    };

    res.json({
      id: campaign.id,
      name: campaign.name,
      message: campaign.message,
      status: campaign.status,
      totalContacts: campaign.totalContacts,
      messagesSent: campaign.messagesSent,
      messagesFailed: campaign.messagesFailed,
      progress: ((campaign.messagesSent || 0) / campaign.totalContacts) * 100,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
      statusCount,
      successRate: campaign.totalContacts > 0
        ? (((campaign.messagesSent || 0) / campaign.totalContacts) * 100).toFixed(2) + '%'
        : '0%'
    });

  } catch (error: any) {
    logger.error('❌ Erro ao buscar campanha:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/disparador/:id/pausar
 * Pausar campanha em execução
 */
router.post('/:id/pausar', authenticate, async (req: AuthRequest, res) => {
  try {
    const campaignId = Number(req.params.id);
    const campaign = await Campaign.findByPk(campaignId);

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    await campaign.update({ status: 'paused' });

    res.json({ message: 'Campanha pausada', campaignId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/disparador/:id/retomar
 * Retomar campanha pausada
 */
router.post('/:id/retomar', authenticate, async (req: AuthRequest, res) => {
  try {
    const campaignId = Number(req.params.id);
    const campaign = await Campaign.findByPk(campaignId);

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    if (campaign.status !== 'paused') {
      return res.status(409).json({ error: 'Apenas campanhas pausadas podem ser retomadas' });
    }

    await campaign.update({ status: 'running' });

    res.json({ message: 'Campanha retomada', campaignId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/disparador/:id/parar
 * Parar campanha
 */
router.post('/:id/parar', authenticate, async (req: AuthRequest, res) => {
  try {
    const campaignId = Number(req.params.id);
    const campaign = await Campaign.findByPk(campaignId);

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    await campaign.update({
      status: 'cancelled',
      completedAt: new Date()
    });

    res.json({ message: 'Campanha parada', campaignId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/disparador/:id/metricas
 * Obter métricas detalhadas da campanha
 */
router.get('/:id/metricas', authenticate, async (req: AuthRequest, res) => {
  try {
    const campaignId = Number(req.params.id);
    const campaign = await Campaign.findByPk(campaignId);

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    // Buscar métricas de mensagens
    const messages = await Message.findAll({
      where: { campaignId },
      attributes: ['status', 'sentAt', 'deliveredAt', 'readAt']
    });

    const sent = messages.filter(m => m.status === 'sent').length;
    const delivered = messages.filter(m => m.status === 'delivered').length;
    const read = messages.filter(m => m.status === 'read').length;
    const failed = messages.filter(m => m.status === 'failed').length;

    const duration = campaign.completedAt && campaign.startedAt
      ? (campaign.completedAt.getTime() - campaign.startedAt.getTime()) / 1000
      : null;

    res.json({
      campaignId,
      status: campaign.status,
      timeline: {
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
        durationSeconds: duration
      },
      metrics: {
        total: campaign.totalContacts,
        sent,
        delivered,
        read,
        failed,
        pending: campaign.totalContacts - (sent + delivered + read + failed)
      },
      rates: {
        sent: ((sent / campaign.totalContacts) * 100).toFixed(2) + '%',
        deliveryRate: ((delivered / campaign.totalContacts) * 100).toFixed(2) + '%',
        readRate: ((read / campaign.totalContacts) * 100).toFixed(2) + '%',
        errorRate: ((failed / campaign.totalContacts) * 100).toFixed(2) + '%'
      },
      throughput: duration
        ? ((campaign.totalContacts / duration) * 60).toFixed(2) + ' msgs/min'
        : null
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/disparador/send-single
 * Envia uma mensagem para um único número
 * Usado pelo EliteDispatcher para disparo em loop
 */
router.post('/send-single', authenticate, async (req: AuthRequest, res) => {
  try {
    const { instanceId, number, message } = req.body;
    if (!instanceId || !number || !message) {
      return res.status(400).json({ error: 'instanceId, number e message são obrigatórios' });
    }

    const instance = await WhatsAppInstance.findByPk(instanceId);
    if (!instance) return res.status(404).json({ error: 'Instância não encontrada' });
    if (instance.status !== 'connected') return res.status(400).json({ error: 'Instância não conectada' });

    const evolutionName = `instance_${instanceId}`;
    await EvolutionService.sendTextMessage(evolutionName, number, message);

    res.json({ success: true, number });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
