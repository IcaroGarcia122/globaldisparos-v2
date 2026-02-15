import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  isJidGroup,
  Browsers,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import config from '../config';
import logger from '../utils/logger';
import { WhatsAppInstance, ActivityLog } from '../models';

interface BaileysConnection {
  socket: WASocket;
  qr?: string;
}

class BaileysService {
  private connections: Map<string, BaileysConnection> = new Map();

  /**
   * Obtém o diretório de auth para uma instância
   */
  private getAuthDir(instanceId: string): string {
    return path.join(config.authSessionsDir, instanceId);
  }

  /**
   * Cria diretório de auth se não existir
   */
  private ensureAuthDir(instanceId: string): void {
    const authDir = this.getAuthDir(instanceId);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }
  }

  /**
   * Conecta uma instância do WhatsApp
   */
  public async connect(instanceId: string): Promise<void> {
    try {
      // Verifica se já está conectado
      if (this.connections.has(instanceId)) {
        logger.info(`Instância ${instanceId} já está conectada`);
        return;
      }

      const instance = await WhatsAppInstance.findByPk(instanceId);
      if (!instance) {
        throw new Error('Instância não encontrada');
      }

      // Atualiza status para connecting
      await instance.update({ status: 'connecting', qrCode: null });

      // Cria diretório de auth
      this.ensureAuthDir(instanceId);

      // Carrega estado de autenticação
      const { state, saveCreds } = await useMultiFileAuthState(this.getAuthDir(instanceId));

      // Cria socket do WhatsApp
      const socket = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger as any),
        },
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        logger: logger as any,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
          return { conversation: '' };
        },
      });

      // Armazena conexão
      this.connections.set(instanceId, { socket });

      // Handler: Atualização de credenciais
      socket.ev.on('creds.update', saveCreds);

      // Handler: Atualização de conexão
      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // Gera QR Code
          const qrCode = await QRCode.toDataURL(qr);
          await instance.update({ qrCode, status: 'connecting' });

          const conn = this.connections.get(instanceId);
          if (conn) {
            conn.qr = qrCode;
          }

          logger.info(`QR Code gerado para instância ${instanceId}`);

          // Log de atividade
          await ActivityLog.create({
            userId: instance.userId,
            instanceId,
            action: 'qr_code_generated',
            details: { message: 'QR Code gerado' },
            level: 'info',
          });
        }

        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          logger.info(`Conexão fechada. Reconectar: ${shouldReconnect}`);

          if (shouldReconnect) {
            // Reconecta automaticamente
            setTimeout(() => {
              this.connect(instanceId).catch((error) => {
                logger.error(`Erro ao reconectar instância ${instanceId}:`, error);
              });
            }, 3000);
          } else {
            // Desconectado permanentemente
            await instance.update({ status: 'disconnected', qrCode: null, phoneNumber: null });
            this.connections.delete(instanceId);

            await ActivityLog.create({
              userId: instance.userId,
              instanceId,
              action: 'disconnected',
              details: { message: 'Desconectado do WhatsApp' },
              level: 'warning',
            });
          }
        } else if (connection === 'open') {
          // Conectado com sucesso
          const phoneNumber = socket.user?.id?.split(':')[0] || null;
          await instance.update({
            status: 'connected',
            qrCode: null,
            phoneNumber,
            connectedAt: new Date(),
          });

          logger.info(`✅ Instância ${instanceId} conectada! Número: ${phoneNumber}`);

          await ActivityLog.create({
            userId: instance.userId,
            instanceId,
            action: 'connected',
            details: { phoneNumber, message: 'Conectado ao WhatsApp' },
            level: 'success',
          });
        }
      });

      // Handler: Mensagens recebidas
      socket.ev.on('messages.upsert', async (m) => {
        // Aqui você pode adicionar lógica para processar mensagens recebidas
        logger.debug(`Mensagem recebida na instância ${instanceId}`);
      });

      logger.info(`Iniciando conexão para instância ${instanceId}...`);
    } catch (error: any) {
      logger.error(`Erro ao conectar instância ${instanceId}:`, error);
      
      const instance = await WhatsAppInstance.findByPk(instanceId);
      if (instance) {
        await instance.update({ status: 'disconnected' });
      }

      throw error;
    }
  }

  /**
   * Desconecta uma instância
   */
  public async disconnect(instanceId: string): Promise<void> {
    try {
      const connection = this.connections.get(instanceId);
      if (!connection) {
        logger.info(`Instância ${instanceId} não está conectada`);
        return;
      }

      // Desconecta o socket
      await connection.socket.logout();
      this.connections.delete(instanceId);

      // Atualiza no banco
      const instance = await WhatsAppInstance.findByPk(instanceId);
      if (instance) {
        await instance.update({
          status: 'disconnected',
          qrCode: null,
          phoneNumber: null,
        });

        await ActivityLog.create({
          userId: instance.userId,
          instanceId,
          action: 'disconnected',
          details: { message: 'Desconectado manualmente' },
          level: 'info',
        });
      }

      // Remove diretório de auth
      const authDir = this.getAuthDir(instanceId);
      if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
      }

      logger.info(`✅ Instância ${instanceId} desconectada`);
    } catch (error) {
      logger.error(`Erro ao desconectar instância ${instanceId}:`, error);
      throw error;
    }
  }

  /**
   * Envia uma mensagem
   */
  public async sendMessage(instanceId: string, phoneNumber: string, message: string): Promise<any> {
    try {
      const connection = this.connections.get(instanceId);
      if (!connection) {
        throw new Error('Instância não está conectada');
      }

      // Formata número
      const jid = phoneNumber.includes('@s.whatsapp.net') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

      // Envia mensagem
      const result = await connection.socket.sendMessage(jid, { text: message });

      logger.info(`Mensagem enviada para ${phoneNumber} via instância ${instanceId}`);
      return result;
    } catch (error) {
      logger.error(`Erro ao enviar mensagem:`, error);
      throw error;
    }
  }

  /**
   * Obtém lista de grupos
   */
  public async getGroups(instanceId: string): Promise<any[]> {
    try {
      const connection = this.connections.get(instanceId);
      if (!connection) {
        throw new Error('Instância não está conectada');
      }

      const chats = await connection.socket.groupFetchAllParticipating();
      const groups = Object.values(chats).filter((chat: any) => isJidGroup(chat.id));

      return groups.map((group: any) => ({
        id: group.id,
        name: group.subject,
        participantsCount: group.participants.length,
        creation: group.creation,
      }));
    } catch (error) {
      logger.error(`Erro ao obter grupos:`, error);
      throw error;
    }
  }

  /**
   * Obtém participantes de um grupo
   */
  public async getGroupParticipants(instanceId: string, groupId: string): Promise<any[]> {
    try {
      const connection = this.connections.get(instanceId);
      if (!connection) {
        throw new Error('Instância não está conectada');
      }

      const metadata = await connection.socket.groupMetadata(groupId);
      
      return metadata.participants.map((participant: any) => ({
        phoneNumber: participant.id.split('@')[0],
        isAdmin: participant.admin === 'admin' || participant.admin === 'superadmin',
      }));
    } catch (error) {
      logger.error(`Erro ao obter participantes do grupo:`, error);
      throw error;
    }
  }

  /**
   * Verifica se uma instância está conectada
   */
  public isConnected(instanceId: string): boolean {
    return this.connections.has(instanceId);
  }

  /**
   * Obtém QR Code de uma instância
   */
  public getQRCode(instanceId: string): string | undefined {
    const connection = this.connections.get(instanceId);
    return connection?.qr;
  }

  /**
   * Obtém todas as conexões ativas
   */
  public getActiveConnections(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Reconecta todas as instâncias ativas ao iniciar o servidor
   */
  public async reconnectAllInstances(): Promise<void> {
    try {
      const instances = await WhatsAppInstance.findAll({
        where: {
          isActive: true,
          status: 'connected',
        },
      });

      logger.info(`Reconectando ${instances.length} instâncias...`);

      for (const instance of instances) {
        try {
          await this.connect(instance.id);
        } catch (error) {
          logger.error(`Erro ao reconectar instância ${instance.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Erro ao reconectar instâncias:', error);
    }
  }
}

export default new BaileysService();
