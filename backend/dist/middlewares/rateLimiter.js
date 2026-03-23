"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookLimiter = exports.authLimiter = exports.globalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = __importDefault(require("../utils/logger"));
// Rotas de polling frequente — isentas do rate limit global
const POLLING_PATHS = [
    '/groups/status',
    '/groups',
    '/instances',
    '/check-status',
    '/health',
    '/stats/logs',
    '/stats/user',
    '/groups/participants',
    '/disparador/status',
];
const isPollingRoute = (req) => req.method === 'GET' &&
    POLLING_PATHS.some(p => req.path.includes(p) || req.originalUrl.includes(p));
/** Rate limit global — 500 req / 15min, polling isento */
exports.globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '2000'),
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/socket.io') || isPollingRoute(req),
    handler: (req, res) => {
        logger_1.default.warn(`[RateLimit] Excedido: ${req.ip} → ${req.path}`);
        res.status(429).json({ error: 'Muitas requisições. Tente novamente em breve.' });
    },
});
/** Rate limit de auth — 20 logins / 15min */
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_, res) => res.status(429).json({ error: 'Muitas tentativas de login. Aguarde 15 minutos.' }),
});
/** Rate limit de webhooks — muito permissivo */
exports.webhookLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => true, // webhooks nunca sofrem rate limit
});
//# sourceMappingURL=rateLimiter.js.map