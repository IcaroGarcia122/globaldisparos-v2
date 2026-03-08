/**
 * EVOLUTION SERVICE - Serviço completo para gerenciar WhatsApp via Evolution API
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import logger from '../utils/logger';
import { WhatsAppInstance } from '../models';

interface ContactData {
  name?: string;
  number: string;
  email?: string;
}

interface BulkMessageOptions {
  interval?: number;
  onProgress?: (progress: {
    current: number;
    total: number;
    contact: ContactData;
    success: boolean;
    error?: string;
  }) => Promise<void>;
  retryFailed?: boolean;
}

interface GroupData {
  id: string;
  name: string;
  description?: string;
  participants?: number;
  isAdmin?: boolean;
  isBroadcast?: boolean;
  profileImage?: string;
}

interface ParticipantData {
  id: string;
  name?: string;
  number: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  profileImage?: string;
}

class EvolutionService {
  private client: AxiosInstance;
  private evolutionUrl: string;
  private apiKey: string;

  constructor() {
    // CRÍTICO: usar 127.0.0.1 ao invés de localhost (Node 18+ resolve como IPv6)
    this.evolutionUrl = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081')
      .replace('localhost', '127.0.0.1');
    this.apiKey = process.env.EVOLUTION_API_KEY || '';

    this.client = axios.create({
      baseURL: this.evolutionUrl,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey   // apikey APENAS no header, nunca no body
      },
      timeout: 30000
    });

    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`[EvolutionAPI] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        logger.error('[EvolutionAPI] Erro:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        return Promise.reject(error);
      }
    );

    logger.info(`✅ EvolutionService inicializado`);
    logger.info(`   URL: ${this.evolutionUrl}`);
    logger.info(`   API Key: ${this.apiKey.substring(0, 5)}...`);
  }

  // ====================================
  // INSTÂNCIAS
  // ====================================

  /**
   * Criar uma nova instância WhatsApp
   * CORREÇÃO: integration deve ser 'WHATSAPP-BAILEYS', sem token no body
   */
  async createInstance(instanceName: string): Promise<any> {
    try {
      logger.info(`🆕 Criar instância: ${instanceName}`);

      const response = await this.client.post('/instance/create', {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'  // ✅ CORRETO (era 'BAILEYS' - errado)
        // ❌ REMOVIDO: token no body causava erro 400
      });

      logger.info(`✅ Instância criada: ${instanceName}`);
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      const data = error.response?.data;

      // 409 = já existe, não é erro real
      if (status === 409) {
        logger.info(`ℹ️ Instância ${instanceName} já existe na Evolution API`);
        return { instanceName, alreadyExists: true };
      }

      logger.error(`❌ Erro ao criar instância ${instanceName}:`, {
        status,
        data,
        message: error.message
      });
      throw error;
    }
  }

  /**
   * Buscar QR Code real da Evolution API
   * CORREÇÃO: rota correta é /instance/connect/{name}
   */
  async fetchQRCode(instanceName: string): Promise<string | null> {
    // Rota oficial e correta da Evolution API
    const endpoint = `/instance/connect/${instanceName}`;

    try {
      logger.debug(`📱 Obtendo QR Code: ${instanceName}`);
      const response = await this.client.get(endpoint);
      const data = response.data;

      logger.info(`✅ QR Code obtido de: ${endpoint}`);

      // Extrai base64 nos formatos possíveis da Evolution API
      let qrCode: string | null =
        data?.base64 ||
        data?.qrcode?.base64 ||
        data?.qr?.base64 ||
        data?.instance?.qrcode?.base64 ||
        data?.instance?.qr?.base64 ||
        null;

      if (!qrCode || typeof qrCode !== 'string') {
        logger.warn(`⚠️ QR Code não encontrado na resposta de ${endpoint}`);
        logger.debug('Resposta completa:', JSON.stringify(data));
        return null;
      }

      // Validação: QR real tem mais de 1000 caracteres
      // e NÃO contém = no meio (apenas no final)
      const hasEqualInMiddle = /=(?!={0,1}$)/.test(qrCode.replace(/^data:image[^,]+,/, ''));
      if (qrCode.length < 1000 || hasEqualInMiddle) {
        logger.warn(`⚠️ QR Code inválido ou fake (length: ${qrCode.length})`);
        return null;
      }

      // Normaliza para data URL
      if (!qrCode.startsWith('data:image')) {
        qrCode = `data:image/png;base64,${qrCode}`;
      }

      logger.info(`✅ QR Code válido: ${qrCode.length} chars`);
      return qrCode;

    } catch (error: any) {
      logger.error(`❌ Erro ao buscar QR de ${endpoint}:`, error.message);
      return null;
    }
  }

  /**
   * Verificar estado da conexão
   */
  async getConnectionState(instanceName: string): Promise<string | null> {
    try {
      const response = await this.client.get(
        `/instance/connectionState/${instanceName}`
      );
      const state = response.data?.instance?.state || response.data?.state;
      logger.debug(`[Connection] ${instanceName} -> ${state}`);
      return state;
    } catch (error: any) {
      logger.error(`❌ Erro ao verificar estado de ${instanceName}:`, error.message);
      return null;
    }
  }

  /**
   * Deletar instância
   */
  async deleteInstance(instanceName: string): Promise<any> {
    try {
      logger.info(`🗑️ Deletando instância: ${instanceName}`);
      const response = await this.client.delete(`/instance/delete/${instanceName}`);
      logger.info(`✅ Instância deletada: ${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Erro ao deletar instância ${instanceName}:`, error.message);
      throw error;
    }
  }

  // ====================================
  // GRUPOS
  // ====================================

  /**
   * Listar grupos da instância
   */
  async listGroups(instanceName: string): Promise<GroupData[]> {
    try {
      logger.info(`📋 Listando grupos: ${instanceName}`);
      const response = await this.client.get(
        `/group/fetchAllGroups/${instanceName}?getParticipants=false`
      );

      const groups = Array.isArray(response.data) ? response.data : [];
      logger.info(`✅ ${groups.length} grupos encontrados`);

      return groups.map((g: any) => ({
        id: g.id,
        name: g.subject || g.name || 'Sem nome',
        description: g.desc || g.description,
        participants: g.size || g.participants?.length || 0,
        isAdmin: g.isAdmin || false,
      }));
    } catch (error: any) {
      logger.error(`❌ Erro ao listar grupos de ${instanceName}:`, error.message);
      return [];
    }
  }

  /**
   * Listar participantes de um grupo
   */
  async listGroupParticipants(
    instanceName: string,
    groupId: string
  ): Promise<ParticipantData[]> {
    try {
      logger.info(`👥 Listando participantes do grupo ${groupId}`);
      const response = await this.client.get(
        `/group/participants/${instanceName}?groupJid=${groupId}`
      );

      const participants = response.data?.participants || response.data || [];
      logger.info(`✅ ${participants.length} participantes encontrados`);

      return participants.map((p: any) => ({
        id: p.id,
        number: p.id.replace('@s.whatsapp.net', '').replace('@g.us', ''),
        name: p.pushName || p.name || '',
        isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
        isSuperAdmin: p.admin === 'superadmin',
      }));
    } catch (error: any) {
      logger.error(`❌ Erro ao listar participantes:`, error.message);
      return [];
    }
  }

  /**
   * Adicionar membros a um grupo com delay
   */
  async addGroupMembers(
    instanceName: string,
    groupId: string,
    phoneNumbers: string[]
  ): Promise<any> {
    try {
      logger.info(`👥 Adicionando ${phoneNumbers.length} membros ao grupo`);

      const response = await this.client.post(
        `/group/updateParticipant/${instanceName}`,
        {
          groupJid: groupId,
          action: 'add',
          participants: phoneNumbers.map(n => `${n}@s.whatsapp.net`)
        }
      );

      logger.info(`✅ Membros adicionados ao grupo ${groupId}`);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Erro ao adicionar membros:`, error.message);
      throw error;
    }
  }

  // ====================================
  // MENSAGENS
  // ====================================

  /**
   * Enviar mensagem de texto
   */
  async sendTextMessage(
    instanceName: string,
    number: string,
    text: string
  ): Promise<any> {
    try {
      const response = await this.client.post(
        `/message/sendText/${instanceName}`,
        {
          number: number.replace(/\D/g, ''),
          text
        }
      );
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Erro ao enviar mensagem para ${number}:`, error.message);
      throw error;
    }
  }

  /**
   * Enviar mensagens em massa com progresso
   */
  async sendBulkMessages(
    instanceName: string,
    contacts: ContactData[],
    message: string,
    options: BulkMessageOptions = {}
  ): Promise<{ success: number; failed: number; total: number }> {
    const { interval = 3000, onProgress } = options;
    let success = 0;
    let failed = 0;
    const total = contacts.length;

    logger.info(`📨 Iniciando disparo para ${total} contatos`);

    for (const contact of contacts) {
      try {
        await this.sendTextMessage(instanceName, contact.number, message);
        success++;

        if (onProgress) {
          await onProgress({ current: success + failed, total, contact, success: true });
        }
      } catch (error: any) {
        failed++;
        logger.error(`❌ Erro ao enviar para ${contact.number}:`, error.message);

        if (onProgress) {
          await onProgress({
            current: success + failed,
            total,
            contact,
            success: false,
            error: error.message
          });
        }
      }

      // Delay entre mensagens
      if (success + failed < total) {
        await new Promise(r => setTimeout(r, interval));
      }
    }

    logger.info(`✅ Disparo concluído: ${success} enviadas, ${failed} falhas`);
    return { success, failed, total };
  }

  /**
   * Verificar se Evolution API está acessível
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/instance/fetchInstances');
      return true;
    } catch {
      return false;
    }
  }
}

export default new EvolutionService();