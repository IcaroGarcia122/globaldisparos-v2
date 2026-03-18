import { randomDelay } from '../utils/delay';
import logger from '../utils/logger';

interface AntiBanConfig {
  minDelay: number;
  maxDelay: number;
  burstLimit: number;   // mensagens antes de pausa longa
  burstDelay: number;   // pausa após burst (ms)
}

class AntiBanService {
  private configs: Map<string, AntiBanConfig> = new Map();
  private counters: Map<string, number> = new Map();

  getConfig(instanceName: string): AntiBanConfig {
    return this.configs.get(instanceName) || {
      minDelay: 2000,
      maxDelay: 8000,
      burstLimit: 20,
      burstDelay: 30000,
    };
  }

  setConfig(instanceName: string, config: Partial<AntiBanConfig>): void {
    const current = this.getConfig(instanceName);
    this.configs.set(instanceName, { ...current, ...config });
  }

  /** Aplica delay anti-ban entre mensagens */
  async applyDelay(instanceName: string, msgIndex: number, interval?: number): Promise<void> {
    const cfg = this.getConfig(instanceName);
    const count = (this.counters.get(instanceName) || 0) + 1;
    this.counters.set(instanceName, count);

    // Pausa longa após burst
    if (count % cfg.burstLimit === 0) {
      logger.info(`[AntiBan] Pausa de ${cfg.burstDelay / 1000}s após ${count} mensagens`);
      await randomDelay(cfg.burstDelay, cfg.burstDelay + 5000);
      return;
    }

    const minMs = interval || cfg.minDelay;
    const maxMs = interval ? interval + 3000 : cfg.maxDelay;
    await randomDelay(minMs, maxMs);
  }

  resetCounter(instanceName: string): void {
    this.counters.delete(instanceName);
  }

  getStatus(instanceName: string) {
    return {
      count: this.counters.get(instanceName) || 0,
      config: this.getConfig(instanceName),
    };
  }
}

export default new AntiBanService();
