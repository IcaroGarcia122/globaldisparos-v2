"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueEvents = exports.Worker = exports.Queue = exports.QUEUES = void 0;
exports.getQueue = getQueue;
exports.closeAllQueues = closeAllQueues;
const bullmq_1 = require("bullmq");
Object.defineProperty(exports, "Queue", { enumerable: true, get: function () { return bullmq_1.Queue; } });
Object.defineProperty(exports, "Worker", { enumerable: true, get: function () { return bullmq_1.Worker; } });
Object.defineProperty(exports, "QueueEvents", { enumerable: true, get: function () { return bullmq_1.QueueEvents; } });
const redis_1 = require("./redis");
const logger_1 = __importDefault(require("../utils/logger"));
// Nomes das filas
exports.QUEUES = {
    SEND_MESSAGES: 'send-messages',
    SEND_MEDIA: 'send-media',
    WEBHOOKS: 'webhooks',
    SCHEDULER: 'scheduler',
};
// Instâncias das filas (lazy — criadas só se Redis disponível)
const queues = new Map();
function getQueue(name) {
    const redis = (0, redis_1.getRedis)();
    if (!redis)
        return null;
    if (!queues.has(name)) {
        const q = new bullmq_1.Queue(name, {
            connection: redis,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: { count: 100 },
                removeOnFail: { count: 50 },
            },
        });
        queues.set(name, q);
    }
    return queues.get(name);
}
async function closeAllQueues() {
    for (const [name, q] of queues) {
        await q.close();
        logger_1.default.info(`[Queue] ${name} fechada`);
    }
    queues.clear();
}
//# sourceMappingURL=queue.js.map