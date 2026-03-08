import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';
import { WhatsAppInstance, ActivityLog } from '../models';
import { WhatsAppAdapter } from './WhatsAppAdapter';
import { Op } from 'sequelize';
import * as http from 'http';
import * as https from 'https';
import { Server as SocketIOServer } from 'socket.io';

class EvolutionAdapter extends WhatsAppAdapter {
  private client: AxiosInstance;
  private evolutionApiUrl: string;
  private evolutionApiKey: string;
  private cachedQRCodes: Map<number, string> = new Map();
  private socketIO: SocketIOServer | null = null;
  private instanceMap: Map<number, string> = new Map();

  constructor() {
    super();

    this.evolutionApiUrl = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081')
      .replace('localhost', '127.0.0.1');
    this.evolutionApiKey = process.env.EVOLUTION_API_KEY || '';

    const httpAgent = new http.Agent({ family: 4 });
    const httpsAgent = new https.Agent({ family: 4 });

    this.client = axios.create({
      baseURL: this.evolutionApiUrl,
      headers: {
        'apikey': this.evolutionApiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
      httpAgent,
      httpsAgent,
    });

    logger.info(`🚀 EvolutionAdapter inicializado - URL: ${this.evolutionApiUrl}`);
  }

  public setSocketIO(socketIO: SocketIOServer): void {
    this.socketIO = socketIO;
    logger.info('✅ Socket.IO injetado no EvolutionAdapter');
  }

  /**
   * Conecta instância — cria na Evolution se não existir, busca QR
   * SEM loops de polling — retorna o que tiver disponível agora
   */
  public async connect(instanceId: number): Promise<void> {
    const instance = await WhatsAppInstance.findByPk(instanceId);
    if (!instance) throw new Error('Instância não encontrada');

    const instanceName = `instance_${instanceId}`;

    // Verifica se já está conectada
    try {
      const stateRes = await this.client.get(`/instance/connectionState/${instanceName}`);
      const state = stateRes.data?.instance?.state || stateRes.data?.state;
      if (state === 'open' || state === 'connected') {
        await instance.update({ status: 'connected', qrCode: null });
        logger.info(`✅ Instância ${instanceName} já está conectada`);
        return;
      }
    } catch { /* não existe ainda */ }

    // Tenta criar instância
    try {
      await this.client.post('/instance/create', {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      });
      logger.info(`✅ Instância ${instanceName} criada na Evolution`);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 409 || status === 400 || status === 403) {
        logger.info(`ℹ️ Instância ${instanceName} já existe (${status})`);
      } else {
        throw err;
      }
    }

    // Aguarda Evolution processar
    await new Promise(r => setTimeout(r, 2000));

    // Busca QR — UMA tentativa apenas, sem loop
    await this.getQRCodeFromAPI(instanceId, instanceName);
  }

  /**
   * Busca QR Code da Evolution API — sem retry loop
   */
  private async getQRCodeFromAPI(instanceId: number, instanceName: string): Promise<void> {
    try {
      const response = await this.client.get(`/instance/connect/${instanceName}`);
      const data = response.data;

      const qrBase64 =
        data?.base64 ||
        data?.qrcode?.base64 ||
        data?.qr?.base64 ||
        null;

      if (qrBase64 && typeof qrBase64 === 'string' && qrBase64.length > 500) {
        const normalized = qrBase64.startsWith('data:image')
          ? qrBase64
          : `data:image/png;base64,${qrBase64}`;

        this.cachedQRCodes.set(instanceId, normalized);

        await WhatsAppInstance.update(
          { qrCode: normalized, status: 'connecting' },
          { where: { id: instanceId } }
        );

        // Emite via Socket.IO se disponível
        if (this.socketIO) {
          const instance = await WhatsAppInstance.findByPk(instanceId);
          if (instance) {
            this.socketIO.to(`user:${instance.userId}`).emit('qr_code', { instanceId, qrCode: normalized });
            this.socketIO.to(`user-${instance.userId}`).emit('qr_code', { instanceId, qrCode: normalized });
          }
        }

        logger.info(`✅ QR Code obtido para ${instanceName}`);
      } else {
        logger.warn(`⚠️ QR não disponível para ${instanceName} ainda`);
      }
    } catch (err: any) {
      logger.warn(`⚠️ Erro ao buscar QR para ${instanceName}: ${err.message}`);
    }
  }

  public async refreshQRCode(instanceId: number): Promise<string | undefined> {
    const instanceName = `instance_${instanceId}`;
    await this.getQRCodeFromAPI(instanceId, instanceName);
    return this.cachedQRCodes.get(instanceId);
  }

  public getQRCode(instanceId: number): string | null {
    return this.cachedQRCodes.get(instanceId) || null;
  }

  public async disconnect(instanceId: number): Promise<void> {
    const instanceName = `instance_${instanceId}`;

    try {
      await this.client.delete(`/instance/logout/${instanceName}`);
    } catch { /* ignora */ }

    try {
      await this.client.delete(`/instance/delete/${instanceName}`);
      logger.info(`✅ Instância ${instanceName} deletada da Evolution`);
    } catch (err: any) {
      logger.warn(`⚠️ Erro ao deletar ${instanceName}: ${err.message}`);
    }

    this.cachedQRCodes.delete(instanceId);
    this.instanceMap.delete(instanceId);

    const instance = await WhatsAppInstance.findByPk(instanceId);
    if (instance) {
      await instance.update({ status: 'disconnected', qrCode: null, phoneNumber: null });
    }
  }

  public async getActiveInstances(): Promise<any[]> {
    try {
      const instances = await WhatsAppInstance.findAll({
        where: { isActive: true }
      });
      return instances;
    } catch (error: any) {
      logger.error(`❌ Erro ao obter instâncias ativas: ${error.message}`);
      return [];
    }
  }

  public async reconnectAllInstances(): Promise<void> {
    try {
      const instances = await WhatsAppInstance.findAll({
        where: { isActive: true, status: 'connected' }
      });

      logger.info(`🔄 Verificando ${instances.length} instâncias conectadas...`);

      for (const instance of instances) {
        try {
          const instanceName = `instance_${instance.id}`;
          const stateRes = await this.client.get(`/instance/connectionState/${instanceName}`);
          const state = stateRes.data?.instance?.state || stateRes.data?.state;

          if (state !== 'open' && state !== 'connected') {
            logger.warn(`⚠️ Instância ${instanceName} não está conectada (state: ${state})`);
            await instance.update({ status: 'disconnected' });
          }
        } catch {
          // Instância não existe na Evolution — marca como desconectada
          await instance.update({ status: 'disconnected' });
        }
      }
    } catch (error: any) {
      logger.error(`❌ Erro em reconnectAllInstances: ${error.message}`);
    }
  }

  public async sendMessage(instanceId: number, to: string, message: string): Promise<any> {
    const instanceName = `instance_${instanceId}`;
    const number = to.replace(/\D/g, '');
    const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;

    const response = await this.client.post(`/message/sendText/${instanceName}`, {
      number: jid,
      text: message
    });

    return response.data;
  }

  public async getGroups(instanceId: number): Promise<any[]> {
    const instanceName = `instance_${instanceId}`;
    try {
      const response = await this.client.get(
        `/group/fetchAllGroups/${instanceName}?getParticipants=false`,
        { timeout: 120000 }
      );
      const raw = Array.isArray(response.data) ? response.data : response.data?.groups || [];
      return raw.map((g: any) => ({
        id: g.id || g.groupId,
        name: g.subject || g.name,
        participantsCount: g.size || g.participants?.length || 0,
      }));
    } catch (err: any) {
      logger.error(`❌ Erro ao buscar grupos: ${err.message}`);
      return [];
    }
  }

  public async getGroupParticipants(instanceId: number, groupId: string): Promise<any[]> {
    const instanceName = `instance_${instanceId}`;
    try {
      const response = await this.client.get(
        `/group/fetchAllGroups/${instanceName}?getParticipants=true`,
        { timeout: 120000 }
      );
      const raw = Array.isArray(response.data) ? response.data : response.data?.groups || [];
      const group = raw.find((g: any) => (g.id || g.groupId) === groupId);
      return group?.participants || [];
    } catch (err: any) {
      logger.error(`❌ Erro ao buscar participantes: ${err.message}`);
      return [];
    }
  }
}

export default new EvolutionAdapter();