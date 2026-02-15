import { Campaign, Message, Contact, WhatsAppInstance, ContactList, ActivityLog } from '../models';
import baileysService from './baileysService';
import antiBanService from './antiBanService';
import logger from '../utils/logger';

interface CampaignProgress {
  campaignId: string;
  status: string;
  totalContacts: number;
  messagesSent: number;
  messagesFailed: number;
  messagesRemaining: number;
  currentContact?: number;
  isPaused: boolean;
}

class CampaignService {
  private runningCampaigns: Map<string, boolean> = new Map();

  /**
   * Cria uma nova campanha
   */
  public async createCampaign(data: {
    userId: string;
    instanceId: string;
    contactListId: string;
    name: string;
    message: string;
    scheduledFor?: Date;
    useAntibanVariations?: boolean;
    useAntibanDelays?: boolean;
    useCommercialHours?: boolean;
  }): Promise<Campaign> {
    try {
      // Obtém lista de contatos
      const contactList = await ContactList.findByPk(data.contactListId, {
        include: [{ model: Contact, as: 'contacts' }],
      });

      if (!contactList) {
        throw new Error('Lista de contatos não encontrada');
      }

      // Cria campanha
      const campaign = await Campaign.create({
        userId: data.userId,
        instanceId: data.instanceId,
        contactListId: data.contactListId,
        name: data.name,
        message: data.message,
        scheduledFor: data.scheduledFor || null,
        totalContacts: contactList.totalContacts,
        messagesScheduled: contactList.totalContacts,
        useAntibanVariations: data.useAntibanVariations ?? true,
        useAntibanDelays: data.useAntibanDelays ?? true,
        useCommercialHours: data.useCommercialHours ?? true,
      });

      // Cria mensagens agendadas
      const contacts = await Contact.findAll({
        where: { contactListId: data.contactListId },
      });

      const messages = contacts.map((contact) => ({
        campaignId: campaign.id,
        contactId: contact.id,
        phoneNumber: contact.phoneNumber,
        messageText: data.message, // Será processado no envio
        status: 'scheduled' as const,
      }));

      await Message.bulkCreate(messages);

      // Log de atividade
      await ActivityLog.create({
        userId: data.userId,
        instanceId: data.instanceId,
        action: 'campaign_created',
        details: {
          campaignId: campaign.id,
          campaignName: data.name,
          totalContacts: contactList.totalContacts,
        },
        level: 'success',
      });

      logger.info(`✅ Campanha ${campaign.id} criada com ${contacts.length} contatos`);

      return campaign;
    } catch (error) {
      logger.error('Erro ao criar campanha:', error);
      throw error;
    }
  }

  /**
   * Inicia uma campanha de disparo
   */
  public async startCampaign(campaignId: string): Promise<void> {
    try {
      const campaign = await Campaign.findByPk(campaignId, {
        include: [{ model: WhatsAppInstance, as: 'instance' }],
      });

      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      if (campaign.status !== 'pending' && campaign.status !== 'paused') {
        throw new Error('Campanha não pode ser iniciada neste status');
      }

      // Verifica se instância está conectada
      if (!baileysService.isConnected(campaign.instanceId)) {
        throw new Error('Instância WhatsApp não está conectada');
      }

      // Atualiza status
      await campaign.update({
        status: 'running',
        startedAt: campaign.startedAt || new Date(),
      });

      // Marca como em execução
      this.runningCampaigns.set(campaignId, true);

      // Log
      await ActivityLog.create({
        userId: campaign.userId,
        instanceId: campaign.instanceId,
        action: 'campaign_started',
        details: {
          campaignId,
          campaignName: campaign.name,
        },
        level: 'info',
      });

      logger.info(`🚀 Campanha ${campaignId} iniciada`);

      // Inicia processo de envio em background
      this.processCampaign(campaignId).catch((error) => {
        logger.error(`Erro ao processar campanha ${campaignId}:`, error);
      });
    } catch (error) {
      logger.error('Erro ao iniciar campanha:', error);
      throw error;
    }
  }

  /**
   * Processa uma campanha (envio das mensagens)
   */
  private async processCampaign(campaignId: string): Promise<void> {
    try {
      const campaign = await Campaign.findByPk(campaignId, {
        include: [{ model: WhatsAppInstance, as: 'instance' }],
      });

      if (!campaign) return;

      // Obtém mensagens pendentes
      const messages = await Message.findAll({
        where: {
          campaignId,
          status: 'scheduled',
        },
        include: [{ model: Contact, as: 'contact' }],
        order: [['createdAt', 'ASC']],
      });

      logger.info(`📨 Processando ${messages.length} mensagens da campanha ${campaignId}`);

      const instance = campaign.instance!;
      const limits = antiBanService.getLimitsByAccountAge(instance.accountAge);
      let messageCount = 0;
      let burstCount = 0;
      const burstLimit = antiBanService.generateBurstLimit();

      for (const message of messages) {
        // Verifica se campanha ainda está rodando
        if (!this.runningCampaigns.get(campaignId)) {
          logger.info(`⏸️ Campanha ${campaignId} pausada`);
          break;
        }

        // Verifica limite diário
        if (await antiBanService.hasReachedDailyLimit(instance.id)) {
          logger.info(`⏳ Limite diário atingido para instância ${instance.id}`);
          await campaign.update({ status: 'paused' });
          await ActivityLog.create({
            userId: campaign.userId,
            instanceId: instance.id,
            action: 'campaign_daily_limit',
            details: { campaignId, limit: limits.dailyLimit },
            level: 'warning',
          });
          break;
        }

        // Verifica horário comercial
        if (campaign.useCommercialHours && !antiBanService.isCommercialHours()) {
          logger.info(`🌙 Fora do horário comercial. Pausando campanha ${campaignId}`);
          await campaign.update({ status: 'paused' });
          
          // Agenda retomada
          const waitTime = antiBanService.getTimeUntilCommercialHours();
          setTimeout(() => {
            this.startCampaign(campaignId).catch((error) => {
              logger.error(`Erro ao retomar campanha ${campaignId}:`, error);
            });
          }, waitTime);
          break;
        }

        // Verifica detecção de ban
        if (await antiBanService.detectPossibleBan(instance.id)) {
          logger.error(`🚨 Possível ban detectado na instância ${instance.id}`);
          await campaign.update({ status: 'banned' });
          await instance.update({ status: 'banned' });
          await ActivityLog.create({
            userId: campaign.userId,
            instanceId: instance.id,
            action: 'possible_ban_detected',
            details: { campaignId, errorRate: instance.getErrorRate() },
            level: 'error',
          });
          break;
        }

        // Prepara mensagem com variáveis e variações
        const contact = message.contact!;
        const finalMessage = antiBanService.prepareMessageForSending(
          campaign.message,
          contact.variables,
          {
            useVariations: campaign.useAntibanVariations,
            useDelays: campaign.useAntibanDelays,
            useCommercialHours: campaign.useCommercialHours,
            useBurstControl: true,
          }
        );

        try {
          // Envia mensagem
          await baileysService.sendMessage(instance.id, message.phoneNumber, finalMessage);

          // Atualiza mensagem
          await message.update({
            status: 'sent',
            messageText: finalMessage,
            sentAt: new Date(),
          });

          // Atualiza contadores
          await campaign.increment('messagesSent');
          await instance.increment(['dailyMessagesSent', 'totalMessagesSent']);
          await instance.update({ lastMessageAt: new Date() });

          messageCount++;
          burstCount++;

          logger.info(`✅ Mensagem enviada para ${message.phoneNumber} (${messageCount}/${messages.length})`);
        } catch (error: any) {
          logger.error(`❌ Erro ao enviar mensagem para ${message.phoneNumber}:`, error.message);

          // Atualiza mensagem como falha
          await message.update({
            status: 'failed',
            errorMessage: error.message,
          });

          // Atualiza contadores de falha
          await campaign.increment('messagesFailed');
          await instance.increment('totalMessagesFailed');
        }

        // Controle de burst - pausa a cada X mensagens
        if (burstCount >= burstLimit && campaign.useAntibanDelays) {
          const burstPause = antiBanService.generateBurstPause();
          logger.info(`⏸️ Pausa burst de ${burstPause / 1000}s após ${burstCount} mensagens`);
          await new Promise((resolve) => setTimeout(resolve, burstPause));
          burstCount = 0;
        }

        // Delay entre mensagens
        if (campaign.useAntibanDelays && messageCount < messages.length) {
          const delay = antiBanService.generateDelay(limits.delayMin, limits.delayMax) * 1000;
          logger.debug(`⏳ Aguardando ${delay / 1000}s antes da próxima mensagem`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      // Verifica se terminou
      const remainingMessages = await Message.count({
        where: {
          campaignId,
          status: 'scheduled',
        },
      });

      if (remainingMessages === 0) {
        await campaign.update({
          status: 'completed',
          completedAt: new Date(),
        });

        await ActivityLog.create({
          userId: campaign.userId,
          instanceId: campaign.instanceId,
          action: 'campaign_completed',
          details: {
            campaignId,
            messagesSent: campaign.messagesSent,
            messagesFailed: campaign.messagesFailed,
            successRate: campaign.getSuccessRate().toFixed(2) + '%',
          },
          level: 'success',
        });

        logger.info(`🎉 Campanha ${campaignId} concluída!`);
      }

      // Remove das campanhas em execução
      this.runningCampaigns.delete(campaignId);
    } catch (error) {
      logger.error(`Erro ao processar campanha ${campaignId}:`, error);
      
      const campaign = await Campaign.findByPk(campaignId);
      if (campaign) {
        await campaign.update({ status: 'paused' });
      }

      this.runningCampaigns.delete(campaignId);
    }
  }

  /**
   * Pausa uma campanha
   */
  public async pauseCampaign(campaignId: string): Promise<void> {
    try {
      this.runningCampaigns.set(campaignId, false);
      
      const campaign = await Campaign.findByPk(campaignId);
      if (campaign) {
        await campaign.update({ status: 'paused' });

        await ActivityLog.create({
          userId: campaign.userId,
          instanceId: campaign.instanceId,
          action: 'campaign_paused',
          details: { campaignId, campaignName: campaign.name },
          level: 'info',
        });
      }

      logger.info(`⏸️ Campanha ${campaignId} pausada`);
    } catch (error) {
      logger.error('Erro ao pausar campanha:', error);
      throw error;
    }
  }

  /**
   * Cancela uma campanha
   */
  public async cancelCampaign(campaignId: string): Promise<void> {
    try {
      this.runningCampaigns.delete(campaignId);
      
      const campaign = await Campaign.findByPk(campaignId);
      if (campaign) {
        await campaign.update({ status: 'cancelled' });

        await ActivityLog.create({
          userId: campaign.userId,
          instanceId: campaign.instanceId,
          action: 'campaign_cancelled',
          details: { campaignId, campaignName: campaign.name },
          level: 'warning',
        });
      }

      logger.info(`❌ Campanha ${campaignId} cancelada`);
    } catch (error) {
      logger.error('Erro ao cancelar campanha:', error);
      throw error;
    }
  }

  /**
   * Obtém progresso de uma campanha
   */
  public async getCampaignProgress(campaignId: string): Promise<CampaignProgress | null> {
    try {
      const campaign = await Campaign.findByPk(campaignId);
      if (!campaign) return null;

      return {
        campaignId: campaign.id,
        status: campaign.status,
        totalContacts: campaign.totalContacts,
        messagesSent: campaign.messagesSent,
        messagesFailed: campaign.messagesFailed,
        messagesRemaining: campaign.totalContacts - campaign.messagesSent - campaign.messagesFailed,
        isPaused: !this.runningCampaigns.get(campaignId),
      };
    } catch (error) {
      logger.error('Erro ao obter progresso da campanha:', error);
      return null;
    }
  }
}

export default new CampaignService();
