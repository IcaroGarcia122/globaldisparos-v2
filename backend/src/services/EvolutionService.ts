/**
 * ✨ EVOLUTION SERVICE - Serviço completo para gerenciar WhatsApp via Evolution API
 * 
 * Responsabilidades:
 * - Criar e gerenciar instâncias WhatsApp
 * - Gerar e obter QR codes
 * - Listar grupos e participantes
 * - Enviar mensagens em massa
 * - Sincronizar status e metadados
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
    this.evolutionUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8081';
    this.apiKey = process.env.EVOLUTION_API_KEY || 'sua_chave_aqui';

    // Criar cliente HTTP com configurações de timeout e retry
    this.client = axios.create({
      baseURL: this.evolutionUrl,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey
      },
      timeout: 30000
    });

    // Interceptor para logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`[EvolutionAPI] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('[EvolutionAPI] Request error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        logger.error('[EvolutionAPI] Response error:', {
          url: error.config?.url,
          status: error.response?.status,
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
   */
  async createInstance(instanceName: string): Promise<any> {
    try {
      logger.info(`🆕 Criar instância: ${instanceName}`);

      const response = await this.client.post('/instance/create', {
        instanceName,
        token: this.apiKey,
        qrcode: true,
        number: '',
        integration: 'BAILEYS' // Usar Baileys como integration padrão
      });

      logger.info(`✅ Instância criada: ${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Erro ao criar instância: ${error.message}`);
      throw error;
    }
  }

  /**
   * Conectar uma instância (iniciar o cliente Baileys)
   */
  async connectInstance(instanceName: string): Promise<any> {
    try {
      logger.info(`🔗 Conectando instância: ${instanceName}`);

      const response = await this.client.get(`/instance/connect/${instanceName}`);

      logger.info(`✅ Instância conectada: ${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Erro ao conectar instância: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obter QR code para escanear
   */
  async getQRCode(instanceName: string): Promise<string> {
    try {
      logger.debug(`📱 Obtendo QR Code: ${instanceName}`);

      // Tentar múltiplos endpoints possíveis
      const endpoints = [
        `/instance/connect/${instanceName}`,      // ✅ CORRETO - rota oficial Evolution API
        `/instance/${instanceName}/qrcode`,        // fallback
        `/instance/qrcode/${instanceName}`,        // fallback
        `/qrcode/${instanceName}`,                 // fallback
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`[QR-SERVICE] Testando endpoint: ${endpoint}`);
          const response = await this.client.get(endpoint);
          
          // Extrair a string base64 em qualquer formato que a Evolution retorne
          let qrCode: string | null = null;
          
          // Se for string direto
          if (typeof response.data?.qr === 'string') {
            qrCode = response.data.qr;
            console.log(`[QR-SERVICE] Encontrado em response.data.qr, length: ${qrCode.length}`);
          } else if (typeof response.data?.base64 === 'string') {
            qrCode = response.data.base64;
            console.log(`[QR-SERVICE] Encontrado em response.data.base64, length: ${qrCode.length}`);
          } else if (typeof response.data?.code === 'string') {
            qrCode = response.data.code;
            console.log(`[QR-SERVICE] Encontrado em response.data.code, length: ${qrCode.length}`);
          }
          // Se for objeto com .base64 dentro
          else if (response.data?.qrcode?.base64 && typeof response.data.qrcode.base64 === 'string') {
            qrCode = response.data.qrcode.base64;
            console.log(`[QR-SERVICE] Encontrado em response.data.qrcode.base64, length: ${qrCode.length}`);
          } else if (response.data?.qrcode?.code && typeof response.data.qrcode.code === 'string') {
            qrCode = response.data.qrcode.code;
            console.log(`[QR-SERVICE] Encontrado em response.data.qrcode.code, length: ${qrCode.length}`);
          }
          // Se a propriedade existe mas é um objeto puro, tenta extrair dela
          else if (typeof response.data?.qrcode === 'object' && response.data.qrcode !== null) {
            const obj = response.data.qrcode as any;
            qrCode = obj.base64 || obj.code || obj.qr || null;
            if (qrCode) console.log(`[QR-SERVICE] Extraído de objeto, length: ${qrCode.length}`);
          }

          if (qrCode && typeof qrCode === 'string' && qrCode.length > 100) {
            logger.info(`✅ QR Code obtido de: ${endpoint} (${qrCode.length} chars)`);
            return qrCode;
          }
        } catch (err) {
          logger.debug(`⊘ Endpoint ${endpoint} não disponível`);
        }
      }

      throw new Error(`Nenhum endpoint de QR Code disponível`);
    } catch (error: any) {
      logger.error(`❌ Erro ao obter QR Code: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obter status da conexão
   */
  async getInstanceStatus(instanceName: string): Promise<any> {
    try {
      const response = await this.client.get(`/instance/connectionState/${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Erro ao obter status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Listar todas as instâncias
   */
  async listInstances(): Promise<any[]> {
    try {
      const response = await this.client.get('/instance/fetchInstances');
      const instances = response.data?.instances || [];
      
      logger.info(`✅ ${instances.length} instâncias listadas`);
      return instances;
    } catch (error: any) {
      logger.error(`❌ Erro ao listar instâncias: ${error.message}`);
      return [];
    }
  }

  /**
   * Deletar uma instância
   */
  async deleteInstance(instanceName: string): Promise<any> {
    try {
      logger.info(`🗑️  Deletando instância: ${instanceName}`);

      const response = await this.client.delete(`/instance/delete/${instanceName}`);

      logger.info(`✅ Instância deletada: ${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Erro ao deletar instância: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obter estado da conexão (para polling do QR Code)
   */
  async getConnectionState(instanceName: string): Promise<string | null> {
    try {
      const response = await this.client.get(`/instance/connectionState/${instanceName}`);
      const state = response.data?.instance?.state || response.data?.state;
      logger.debug(`[Connection] ${instanceName} -> ${state}`);
      return state;
    } catch (error: any) {
      logger.debug(`[Connection] Erro ao verificar: ${error.message}`);
      return null;
    }
  }

  /**
   * Buscar QR Code (método isolado)
   */
  async fetchQRCode(instanceName: string): Promise<string | null> {
    try {
      const qrCode = await this.getQRCode(instanceName);
      return qrCode;
    } catch (error: any) {
      logger.debug(`[QRCode] Erro: ${error.message}`);
      return null;
    }
  }

  // ====================================
  // GRUPOS
  // ====================================

  /**
   * Obter lista de grupos da instância
   */
  async getGroups(instanceName: string): Promise<GroupData[]> {
    try {
      logger.info(`📋 Buscando grupos: ${instanceName}`);

      // Tentar múltiplos endpoints possíveis
      const endpoints = [
        `/group/fetchAllGroups/${instanceName}`,
        `/group/list/${instanceName}`,
        `/chat/findChats/${instanceName}?type=group`,
        `/chats/${instanceName}?filter=group`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await this.client.get(endpoint);
          
          const groups = Array.isArray(response.data)
            ? response.data
            : response.data?.groups || response.data?.chats || response.data;

          if (Array.isArray(groups) && groups.length > 0) {
            logger.info(`✅ ${groups.length} grupos obtidos de: ${endpoint}`);
            return this.normalizeGroups(groups);
          }
        } catch (err) {
          logger.debug(`⊘ Endpoint ${endpoint} não disponível`);
        }
      }

      logger.warn(`⚠️  Nenhum grupo encontrado para ${instanceName}`);
      return [];
    } catch (error: any) {
      logger.error(`❌ Erro ao obter grupos: ${error.message}`);
      throw error;
    }
  }

  /**
   * Normalizar dados dos grupos para formato padrão
   */
  private normalizeGroups(groups: any[]): GroupData[] {
    return groups
      .filter(g => !g.isUser && !g.isBroadcast) // Filtrar apenas grupos
      .map(g => ({
        id: g.id || g.jid || g.groupJid,
        name: g.name || g.subject || 'Grupo Sem Nome',
        description: g.description || g.subject,
        participants: g.participants?.length || 0,
        isAdmin: g.isAdmin || false,
        isBroadcast: g.isBroadcast || false,
        profileImage: g.profileImage || g.image
      }));
  }

  /**
   * Obter participantes de um grupo
   */
  async getGroupParticipants(
    instanceName: string,
    groupId: string
  ): Promise<ParticipantData[]> {
    try {
      logger.info(`👥 Buscando participantes do grupo: ${groupId}`);

      const endpoints = [
        `/group/participants/${instanceName}`,
        `/group/${groupId}/participants/${instanceName}`,
        `/chat/${groupId}/participants/${instanceName}`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await this.client.get(endpoint, {
            params: { groupJid: groupId }
          });

          const participants = Array.isArray(response.data)
            ? response.data
            : response.data?.participants || response.data;

          if (Array.isArray(participants) && participants.length > 0) {
            logger.info(`✅ ${participants.length} participantes obtidos`);
            return this.normalizeParticipants(participants);
          }
        } catch (err) {
          logger.debug(`⊘ Endpoint ${endpoint} não disponível`);
        }
      }

      logger.warn(`⚠️  Nenhum participante encontrado`);
      return [];
    } catch (error: any) {
      logger.error(`❌ Erro ao obter participantes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Normalizar dados de participantes
   */
  private normalizeParticipants(participants: any[]): ParticipantData[] {
    return participants.map(p => ({
      id: p.id || p.jid || p.number,
      name: p.name || p.displayName || p.notify || 'Sem Nome',
      number: (p.number || p.jid || '').replace(/\D/g, ''),
      isAdmin: p.isAdmin || false,
      isSuperAdmin: p.isSuperAdmin || false,
      profileImage: p.profileImage || p.image
    }));
  }

  // ====================================
  // MENSAGENS
  // ====================================

  /**
   * Enviar mensagem de texto
   */
  async sendMessage(
    instanceName: string,
    phoneNumber: string,
    message: string
  ): Promise<any> {
    try {
      logger.debug(`📧 Enviando mensagem para ${phoneNumber}`);

      const phoneNormalized = phoneNumber.replace(/\D/g, '');

      const response = await this.client.post(
        `/message/sendText/${instanceName}`,
        {
          number: phoneNormalized,
          text: message
        }
      );

      logger.info(`✅ Mensagem enviada para ${phoneNumber}`);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Erro ao enviar mensagem: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enviar mensagens em massa com intervalo
   */
  async sendBulkMessages(
    instanceName: string,
    contacts: ContactData[],
    messageTemplate: string,
    options: BulkMessageOptions = {}
  ): Promise<any[]> {
    const {
      interval = 3000,
      onProgress,
      retryFailed = false
    } = options;

    const results: any[] = [];
    const failed: ContactData[] = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      try {
        // Personalizar mensagem com dados do contato
        const personalizedMessage = messageTemplate
          .replace(/{nome}/g, contact.name || contact.number)
          .replace(/{numero}/g, contact.number)
          .replace(/{email}/g, contact.email || '');

        // Enviar mensagem
        const result = await this.sendMessage(
          instanceName,
          contact.number,
          personalizedMessage
        );

        results.push({
          contact,
          success: true,
          result,
          sentAt: new Date()
        });

        // Progress callback
        if (onProgress) {
          await onProgress({
            current: i + 1,
            total: contacts.length,
            contact,
            success: true
          });
        }

        logger.debug(`✅ [${i + 1}/${contacts.length}] Enviado para ${contact.number}`);

      } catch (error: any) {
        logger.warn(`❌ [${i + 1}/${contacts.length}] Erro para ${contact.number}: ${error.message}`);
        
        results.push({
          contact,
          success: false,
          error: error.message,
          sentAt: new Date()
        });

        failed.push(contact);

        // Progress callback
        if (onProgress) {
          await onProgress({
            current: i + 1,
            total: contacts.length,
            contact,
            success: false,
            error: error.message
          });
        }
      }

      // Aguardar intervalo entre mensagens (anti-ban)
      if (i < contacts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    // Retry de mensagens falhadas se solicitado
    if (retryFailed && failed.length > 0) {
      logger.info(`🔄 Retentar ${failed.length} mensagens falhadas...`);
      return this.sendBulkMessages(instanceName, failed, messageTemplate, {
        ...options,
        retryFailed: false // Evitar loop infinito
      });
    }

    const successful = results.filter(r => r.success).length;
    const unsuccessful = results.filter(r => !r.success).length;

    logger.info(`
      📊 RESUMO DO DISPARO:
      ✅ Enviadas: ${successful}
      ❌ Erro: ${unsuccessful}
      ⏱️  Total: ${contacts.length}
      💯 Taxa de sucesso: ${((successful / contacts.length) * 100).toFixed(2)}%
    `);

    return results;
  }

  // ====================================
  // UTILITÁRIOS
  // ====================================

  /**
   * Verificar saúde da Evolution API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/', { timeout: 5000 });
      logger.info('✅ Evolution API respondendo');
      return true;
    } catch (error) {
      logger.error('❌ Evolution API não respondendo');
      return false;
    }
  }

  /**
   * Reconectar todas as instâncias ativas
   */
  async reconnectAll(): Promise<void> {
    try {
      logger.info('🔄 Reconectando todas as instâncias...');
      
      const instances = await WhatsAppInstance.findAll({
        where: { isActive: true }
      });

      for (const instance of instances) {
        try {
          await this.connectInstance(instance.name);
          logger.info(`✅ Reconectada: ${instance.name}`);
        } catch (error) {
          logger.warn(`⚠️  Erro ao reconectar ${instance.name}`);
        }
      }
    } catch (error: any) {
      logger.error('❌ Erro ao reconectar instâncias:', error.message);
    }
  }
}

// Exportar singleton
export default new EvolutionService();
