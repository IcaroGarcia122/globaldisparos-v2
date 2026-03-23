"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const delay_1 = require("../utils/delay");
const logger_1 = __importDefault(require("../utils/logger"));
class AntiBanService {
    constructor() {
        this.configs = new Map();
        this.counters = new Map();
    }
    getConfig(instanceName) {
        return this.configs.get(instanceName) || {
            minDelay: 2000,
            maxDelay: 8000,
            burstLimit: 20,
            burstDelay: 30000,
        };
    }
    setConfig(instanceName, config) {
        const current = this.getConfig(instanceName);
        this.configs.set(instanceName, { ...current, ...config });
    }
    /** Aplica delay anti-ban entre mensagens */
    async applyDelay(instanceName, msgIndex, interval) {
        const cfg = this.getConfig(instanceName);
        const count = (this.counters.get(instanceName) || 0) + 1;
        this.counters.set(instanceName, count);
        // Pausa longa após burst
        if (count % cfg.burstLimit === 0) {
            logger_1.default.info(`[AntiBan] Pausa de ${cfg.burstDelay / 1000}s após ${count} mensagens`);
            await (0, delay_1.randomDelay)(cfg.burstDelay, cfg.burstDelay + 5000);
            return;
        }
        const minMs = interval || cfg.minDelay;
        const maxMs = interval ? interval + 3000 : cfg.maxDelay;
        await (0, delay_1.randomDelay)(minMs, maxMs);
    }
    resetCounter(instanceName) {
        this.counters.delete(instanceName);
    }
    getStatus(instanceName) {
        return {
            count: this.counters.get(instanceName) || 0,
            config: this.getConfig(instanceName),
        };
    }
}
exports.default = new AntiBanService();
//# sourceMappingURL=antiban.service.js.map