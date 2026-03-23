"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = void 0;
exports.getRedis = getRedis;
exports.connectRedis = connectRedis;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = __importDefault(require("../utils/logger"));
let redisClient = null;
function getRedis() {
    return redisClient;
}
async function connectRedis() {
    const host = process.env.REDIS_HOST;
    if (!host) {
        logger_1.default.warn('[Redis] REDIS_HOST não configurado — Redis desativado (sistema funciona sem Redis)');
        return;
    }
    try {
        redisClient = new ioredis_1.default({
            host: host.replace('localhost', '127.0.0.1'),
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true,
        });
        await redisClient.connect();
        await redisClient.ping();
        logger_1.default.info('[Redis] Conectado com sucesso');
    }
    catch (err) {
        logger_1.default.warn(`[Redis] Falha na conexão: ${err.message} — continuando sem Redis`);
        redisClient = null;
    }
}
// Cache simples em memória como fallback quando Redis não disponível
const memoryCache = new Map();
exports.cache = {
    async get(key) {
        if (redisClient) {
            const val = await redisClient.get(key);
            return val ? JSON.parse(val) : null;
        }
        const entry = memoryCache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expires) {
            memoryCache.delete(key);
            return null;
        }
        return entry.value;
    },
    async set(key, value, ttlSeconds = 300) {
        if (redisClient) {
            await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
            return;
        }
        memoryCache.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
    },
    async del(key) {
        if (redisClient) {
            await redisClient.del(key);
            return;
        }
        memoryCache.delete(key);
    },
    async keys(pattern) {
        if (redisClient)
            return redisClient.keys(pattern);
        const regex = new RegExp(pattern.replace('*', '.*'));
        return [...memoryCache.keys()].filter(k => regex.test(k));
    },
};
//# sourceMappingURL=redis.js.map