import config from '../config';
import { WhatsAppInstance } from '../models';
import logger from '../utils/logger';

export interface AntiBanLimits {
  dailyLimit: number;
  delayMin: number;
  delayMax: number;
}

export interface AntiBanConfig {
  useVariations: boolean;
  useDelays: boolean;
  useCommercialHours: boolean;
  useBurstControl: boolean;
}

class AntiBanService {
  /**
   * Obtém os limites anti-ban baseado na idade da conta
   */
  public getLimitsByAccountAge(accountAge: number): AntiBanLimits {
    const { antiBan } = config;

    if (accountAge < antiBan.newAccountDays) {
      return {
        dailyLimit: antiBan.newDailyLimit,
        delayMin: antiBan.newDelayMin,
        delayMax: antiBan.newDelayMax,
      };
    }

    if (accountAge < antiBan.mediumAccountDays) {
      return {
        dailyLimit: antiBan.mediumDailyLimit,
        delayMin: antiBan.mediumDelayMin,
        delayMax: antiBan.mediumDelayMax,
      };
    }

    return {
      dailyLimit: antiBan.oldDailyLimit,
      delayMin: antiBan.oldDelayMin,
      delayMax: antiBan.oldDelayMax,
    };
  }

  /**
   * Verifica se a instância atingiu o limite diário
   */
  public async hasReachedDailyLimit(instanceId: string): Promise<boolean> {
    try {
      const instance = await WhatsAppInstance.findByPk(instanceId);
      if (!instance) return true;

      const limits = this.getLimitsByAccountAge(instance.accountAge);
      return instance.dailyMessagesSent >= limits.dailyLimit;
    } catch (error) {
      logger.error('Erro ao verificar limite diário:', error);
      return true;
    }
  }

  /**
   * Gera delay randômico com variação adicional
   */
  public generateDelay(minSeconds: number, maxSeconds: number): number {
    const baseDelay = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds);
    // Adiciona variação de ±20%
    const variation = baseDelay * 0.2;
    const finalDelay = baseDelay + (Math.random() * variation * 2 - variation);
    return Math.max(1, Math.floor(finalDelay));
  }

  /**
   * Verifica se está dentro do horário comercial (9h às 21h)
   */
  public isCommercialHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    return hour >= config.antiBan.startHour && hour < config.antiBan.endHour;
  }

  /**
   * Calcula tempo de espera até o próximo horário comercial
   */
  public getTimeUntilCommercialHours(): number {
    const now = new Date();
    const hour = now.getHours();

    if (hour < config.antiBan.startHour) {
      // Antes das 9h
      const waitHours = config.antiBan.startHour - hour;
      return waitHours * 60 * 60 * 1000;
    }

    if (hour >= config.antiBan.endHour) {
      // Depois das 21h - espera até 9h do próximo dia
      const hoursUntilMidnight = 24 - hour;
      const totalWaitHours = hoursUntilMidnight + config.antiBan.startHour;
      return totalWaitHours * 60 * 60 * 1000;
    }

    return 0;
  }

  /**
   * Gera variações automáticas de mensagem
   */
  public generateMessageVariations(originalMessage: string): string[] {
    const variations = [originalMessage];

    // Variação 1: Adiciona emoji no final
    const emojis = ['😊', '👍', '✨', '🌟', '💯'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    variations.push(`${originalMessage} ${randomEmoji}`);

    // Variação 2: Adiciona prefixo casual
    const prefixes = ['Oi! ', 'Olá! ', 'E aí! ', 'Opa! '];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    variations.push(`${randomPrefix}${originalMessage}`);

    // Variação 3: Adiciona despedida
    const closings = [' Abraço!', ' Tmj!', ' Valeu!', ' Até mais!'];
    const randomClosing = closings[Math.floor(Math.random() * closings.length)];
    variations.push(`${originalMessage}${randomClosing}`);

    return variations;
  }

  /**
   * Substitui variáveis na mensagem ({{nome}}, {{data}}, etc)
   */
  public replaceVariables(message: string, variables: Record<string, string>): string {
    let result = message;

    // Variáveis do contato
    Object.keys(variables).forEach((key) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      result = result.replace(regex, variables[key]);
    });

    // Variáveis de sistema
    const now = new Date();
    const systemVariables: Record<string, string> = {
      data: now.toLocaleDateString('pt-BR'),
      hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      dia_semana: now.toLocaleDateString('pt-BR', { weekday: 'long' }),
      mes: now.toLocaleDateString('pt-BR', { month: 'long' }),
      ano: now.getFullYear().toString(),
    };

    Object.keys(systemVariables).forEach((key) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      result = result.replace(regex, systemVariables[key]);
    });

    return result;
  }

  /**
   * Seleciona uma variação aleatória de mensagem
   */
  public selectRandomVariation(variations: string[]): string {
    return variations[Math.floor(Math.random() * variations.length)];
  }

  /**
   * Gera número aleatório para pausa burst (a cada X mensagens)
   */
  public generateBurstLimit(): number {
    return Math.floor(Math.random() * (config.antiBan.burstMax - config.antiBan.burstMin + 1) + config.antiBan.burstMin);
  }

  /**
   * Gera tempo de pausa burst em milissegundos
   */
  public generateBurstPause(): number {
    const seconds = Math.floor(Math.random() * (config.antiBan.pauseMax - config.antiBan.pauseMin + 1) + config.antiBan.pauseMin);
    return seconds * 1000;
  }

  /**
   * Verifica se a instância está possivelmente banida (taxa de erro > 70%)
   */
  public async detectPossibleBan(instanceId: string): Promise<boolean> {
    try {
      const instance = await WhatsAppInstance.findByPk(instanceId);
      if (!instance) return false;

      const errorRate = instance.getErrorRate();
      return errorRate >= config.antiBan.errorThreshold;
    } catch (error) {
      logger.error('Erro ao detectar ban:', error);
      return false;
    }
  }

  /**
   * Reseta contadores diários (deve ser executado via cron às 00:00)
   */
  public async resetDailyCounters(): Promise<void> {
    try {
      await WhatsAppInstance.update(
        { dailyMessagesSent: 0 },
        { where: {} }
      );
      logger.info('✅ Contadores diários resetados com sucesso');
    } catch (error) {
      logger.error('❌ Erro ao resetar contadores diários:', error);
    }
  }

  /**
   * Prepara mensagem completa para envio (variações + variáveis)
   */
  public prepareMessageForSending(
    originalMessage: string,
    contactVariables: Record<string, string>,
    config: AntiBanConfig
  ): string {
    // 1. Substitui variáveis
    let message = this.replaceVariables(originalMessage, contactVariables);

    // 2. Gera variações se habilitado
    if (config.useVariations) {
      const variations = this.generateMessageVariations(message);
      message = this.selectRandomVariation(variations);
    }

    return message;
  }

  /**
   * Obtém informações resumidas de anti-ban para uma instância
   */
  public async getAntiBanInfo(instanceId: string): Promise<any> {
    try {
      const instance = await WhatsAppInstance.findByPk(instanceId);
      if (!instance) return null;

      const limits = this.getLimitsByAccountAge(instance.accountAge);
      const errorRate = instance.getErrorRate();
      const isPossiblyBanned = errorRate >= config.antiBan.errorThreshold;

      return {
        accountAge: instance.accountAge,
        ageCategory: instance.getAgeCategory(),
        dailyLimit: limits.dailyLimit,
        dailyUsed: instance.dailyMessagesSent,
        dailyRemaining: Math.max(0, limits.dailyLimit - instance.dailyMessagesSent),
        delayRange: `${limits.delayMin}-${limits.delayMax}s`,
        errorRate: errorRate.toFixed(2) + '%',
        isPossiblyBanned,
        isCommercialHours: this.isCommercialHours(),
        totalMessagesSent: instance.totalMessagesSent,
        totalMessagesFailed: instance.totalMessagesFailed,
      };
    } catch (error) {
      logger.error('Erro ao obter info anti-ban:', error);
      return null;
    }
  }
}

export default new AntiBanService();
