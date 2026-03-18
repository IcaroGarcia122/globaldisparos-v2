import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import logger from '../utils/logger';

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

const isPollingRoute = (req: Request) =>
  req.method === 'GET' &&
  POLLING_PATHS.some(p => req.path.includes(p) || req.originalUrl.includes(p));

/** Rate limit global — 500 req / 15min, polling isento */
export const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '2000'),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/socket.io') || isPollingRoute(req),
  handler: (req, res) => {
    logger.warn(`[RateLimit] Excedido: ${req.ip} → ${req.path}`);
    res.status(429).json({ error: 'Muitas requisições. Tente novamente em breve.' });
  },
});

/** Rate limit de auth — 20 logins / 15min */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_, res) =>
    res.status(429).json({ error: 'Muitas tentativas de login. Aguarde 15 minutos.' }),
});

/** Rate limit de webhooks — muito permissivo */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => true, // webhooks nunca sofrem rate limit
});