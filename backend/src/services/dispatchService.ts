/**
 * Dispatch Service
 * Gerencia disparo em massa de mensagens com progresso em tempo real
 */

import { io } from '../server';
import logger from '../utils/logger';
import evolutionService from './EvolutionService';
import { Campaign } from '../models';

interface DispatchProgress {
  sent: number;
  errors: number;
  total: number;
  percentage: number;
  currentNumber: string;
  status: 'idle' | 'sending' | 'done';
}

class DispatchService {
  /**
   * Disparar campanha para múltiplos números
   */
  async dispararCampanha(
    instanceName: string,
    numeros: string[],
    mensagem: string,
    userId: number,
    delay: number = 2000
  ): Promise<{ enviadas: number; erros: number; total: number }> {
    let enviadas = 0;
    let erros = 0;
    const total = numeros.length;

    const userSockets = this.getUserSockets(userId);
    if (userSockets.length === 0) {
      logger.warn(`[Dispatch] Nenhum socket conectado para usuario ${userId}`);
    }

    logger.info(`[Dispatch] Iniciando disparo para ${total} números`);

    for (const numero of numeros) {
      try {
        // Enviar mensagem via Evolution API
        const success = await evolutionService.sendMessage(
          instanceName,
          numero,
          mensagem
        );

        if (success) {
          enviadas++;
        } else {
          erros++;
        }

        logger.debug(`[Dispatch] ${numero} -> ${success ? 'OK' : 'ERRO'}`);
      } catch (err: any) {
        erros++;
        logger.error(`[Dispatch] Erro ao enviar para ${numero}:`, err.message);
      }

      // Emitir progresso em tempo real via Socket.IO
      const percentage = Math.round(((enviadas + erros) / total) * 100);
      const progress: DispatchProgress = {
        sent: enviadas,
        errors: erros,
        total,
        percentage,
        currentNumber: numero,
        status: (enviadas + erros) === total ? 'done' : 'sending'
      };

      this.emitProgressToUser(userId, progress);

      // Aguardar delay para próxima mensagem
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    logger.info(
      `[Dispatch] Disparo concluído: ${enviadas}/${total} enviadas, ${erros} erros`
    );

    return { enviadas, erros, total };
  }

  /**
   * Emitir progresso para usuário via Socket.IO
   */
  private emitProgressToUser(userId: number, progress: DispatchProgress): void {
    const userSockets = this.getUserSockets(userId);
    userSockets.forEach((socket) => {
      socket.emit('dispatch_progress', progress);
      logger.debug(`[Dispatch] Emitido progresso para ${socket.id}`);
    });
  }

  /**
   * Obter sockets do usuário
   */
  private getUserSockets(userId: number): any[] {
    const sockets: any[] = [];
    io.sockets.sockets.forEach((socket) => {
      // O userId está armazenado em socket.data durante autenticação
      if (socket.data?.userId === userId) {
        sockets.push(socket);
      }
    });
    return sockets;
  }

  /**
   * Salvar resultado de campanha no banco
   */
  async saveCampaignResult(
    campaignId: number,
    enviadas: number,
    erros: number
  ): Promise<void> {
    try {
      const campaign = await Campaign.findByPk(campaignId);
      if (campaign) {
        campaign.messagesSent = enviadas;
        campaign.messagesFailed = erros;
        campaign.status = enviadas > 0 ? 'completed' : 'cancelled';
        campaign.completedAt = new Date();
        await campaign.save();
        logger.info(`[Dispatch] Campanha ${campaignId} salva no banco`);
      }
    } catch (err: any) {
      logger.error(`[Dispatch] Erro ao salvar campanha: ${err.message}`);
    }
  }
}

export default new DispatchService();
