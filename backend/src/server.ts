import { runWebhookStartup } from './utils/webhookStartup';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { Server } from 'socket.io';
import http from 'http';
import config from './config';
import logger from './utils/logger';
import { testConnection, syncDatabase } from './config/database';
import { WhatsAppInstance, User } from './models';
import whatsappService from './adapters/whatsapp.config';
import antiBanService from './services/antiBanService';
import cron from 'node-cron';

// ===================================
// PRODUCTION-GRADE MODULES
// ===================================
import envConfig from './config/validation';
import { globalRateLimiter, authRateLimiter, apiRateLimiter, statusPollingRateLimiter } from './middleware/rateLimiting';
import { setupSecurityHeaders, setupCORS, setupAdditionalSecurityMiddleware } from './middleware/securityHeaders';
import { setupGlobalErrorHandler, asyncHandler } from './middleware/errorHandler';
import redisService from './services/redisService';
import queueService from './services/queueService';
import auditService, { AuditAction } from './services/auditService';
import jwtService from './utils/jwt';
import websocketService from './services/websocketService';

const app: Express = express();
const server = http.createServer(app);

// ===================================
// SOCKET.IO
// ===================================
export const io = new Server(server, {
  cors: {
    origin: config.frontendUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  path: '/socket.io/',
  serveClient: false,
});

// MIDDLEWARE DE AUTENTICACAO PARA SOCKET.IO
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
             || socket.handshake.headers?.authorization?.replace('Bearer ', '');

  if (!token) {
    console.warn(`[SOCKET-AUTH] Nenhum token fornecido para socket ${socket.id}`);
    socket.data.userId = null;
    socket.data.authenticated = false;
    return next();
  }

  try {
    const decoded = jwtService.verifyAccessToken(token) as any;
    socket.data.userId = decoded.userId || decoded.id;
    socket.data.authenticated = true;
    console.log(`[SOCKET-AUTH] Socket ${socket.id} autenticado para userId: ${socket.data.userId}`);
    next();
  } catch (err: any) {
    console.error(`[SOCKET-AUTH] Token invalido para socket ${socket.id}:`, err.message);
    socket.data.userId = null;
    socket.data.authenticated = false;
    return next();
  }
});

io.on('connection', (socket) => {
  logger.info(`Cliente conectado via Socket.IO: ${socket.id}`);

  if (socket.data.userId) {
    websocketService.registerUserSocket(socket, socket.data.userId);
    socket.join(`user:${socket.data.userId}`);
    socket.join(`user-${socket.data.userId}`);
    logger.info(`Socket ${socket.id} registrado para usuario ${socket.data.userId}`);
  }

  socket.on('register_socket', (data: any) => {
    logger.info(`[REGISTER-SOCKET] Socket ${socket.id} registrado via evento do frontend`);
  });

  socket.on('disconnect', () => {
    logger.info(`Cliente desconectado: ${socket.id}`);
  });

  socket.on('error', (error) => {
    logger.error(`Socket.IO erro para ${socket.id}:`, error);
  });
});

// ===================================
// MIDDLEWARES
// ===================================
app.use(helmet());
setupSecurityHeaders(app);
setupCORS(app);
app.use(setupAdditionalSecurityMiddleware);
app.use(compression());
app.use(globalRateLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===================================
// ROTAS
// ===================================
import authRoutes from './routes/auth';
import instanceRoutes from './routes/instances';
import contactRoutes from './routes/contacts';
import campaignRoutes from './routes/campaigns';
import groupRoutes from './routes/groups';
import disparadorRoutes from './routes/disparador';
import statsRoutes from './routes/stats';
import webhookRoutes from './routes/webhook';

app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/instances', statusPollingRateLimiter, instanceRoutes);
app.use('/api/contacts', apiRateLimiter, contactRoutes);
app.use('/api/campaigns', apiRateLimiter, campaignRoutes);
app.use('/api/disparador', apiRateLimiter, disparadorRoutes);
app.use('/api/groups', apiRateLimiter, groupRoutes);
app.use('/api/stats', apiRateLimiter, statsRoutes);
app.use('/api/webhook', webhookRoutes);

// Health check
app.get('/health', asyncHandler(async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: envConfig.nodeEnv,
  });
}));

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path, method: req.method });
});

// Global error handler
setupGlobalErrorHandler(app);

// ===================================
// INICIALIZACAO
// ===================================
const startServer = async (): Promise<void> => {
  try {
    logger.info('Validating environment configuration...');

    // Database
    try {
      await Promise.race([
        testConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database connection timeout')), 8000))
      ]);
      logger.info('Database connected');
    } catch (dbError) {
      logger.warn('Database connection failed, continuando...');
    }

    try {
      await Promise.race([
        syncDatabase(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database sync timeout')), 10000))
      ]);
      logger.info('Database synchronized');
    } catch (syncError) {
      logger.warn('Database sync failed (will retry later)');
    }

    // Admin user
    try {
      const bcrypt = require('bcryptjs');
      const adminExists = await User.findOne({ where: { email: 'admin@gmail.com' } });
      if (!adminExists) {
        const hashedPassword = await bcrypt.hash('vip2026', 10);
        await User.create({
          email: 'admin@gmail.com',
          password: hashedPassword,
          fullName: 'Administrador',
          role: 'admin',
          plan: 'enterprise',
          isActive: true
        });
        logger.info('Usuario admin criado: admin@gmail.com / vip2026');
      } else {
        logger.info('Usuario admin ja existe');
      }
    } catch (error) {
      logger.error('Erro ao criar usuario admin:', error);
    }

    // Redis
    try {
      if (envConfig.redisHost?.trim()) {
        const redisReady = await Promise.race([
          redisService.ping(),
          new Promise(resolve => setTimeout(() => resolve(false), 3000))
        ]);
        if (redisReady) {
          logger.info('Redis cache service initialized');
        } else {
          logger.warn('Redis not available, continuing with degraded caching');
        }
      } else {
        logger.warn('Redis disabled (REDIS_HOST not configured)');
      }
    } catch (err) {
      logger.warn('Redis initialization failed, continuing');
    }

    // Queue
    try {
      await Promise.race([
        queueService.init(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Queue init timeout')), 5000))
      ]);
      logger.info('Job queue service initialized');
    } catch (err) {
      logger.warn('Job queue service not available, some features may be limited');
    }

    logger.info('JWT token service initialized');

    // Inject Socket.IO
    try {
      whatsappService.setSocketIO(io);
      logger.info('Socket.IO injected into WhatsApp service');
    } catch (error) {
      logger.warn('Failed to inject Socket.IO into service');
    }

    // Start HTTP server
    console.log('\n[STARTUP] EVOLUTION_API_URL:', process.env.EVOLUTION_API_URL || 'NOT SET');
    console.log('[STARTUP] EVOLUTION_API_KEY:', process.env.EVOLUTION_API_KEY ? 'SET' : 'NOT SET\n');

    server.listen(config.port, config.host, () => {
      logger.info(`Server running on http://${config.host}:${config.port}`);
      logger.info(`Frontend: ${config.frontendUrl}`);
      logger.info(`Environment: ${config.env}`);

      // Background tasks
      (async () => {
        try {
          // Sincroniza instancias com Evolution e registra webhooks
          try {
            await runWebhookStartup();
          } catch (err: any) {
            logger.warn('Webhook startup falhou (nao critico):', err.message);
          }

          // Cron: reset diario de contadores anti-ban
          cron.schedule('0 0 * * *', async () => {
            logger.info('Executing daily counter reset...');
            try {
              await antiBanService.resetDailyCounters();
            } catch (error) {
              logger.error('Daily reset failed:', error);
            }
          });

          // Cron: limpeza de jobs antigos
          cron.schedule('0 */6 * * *', async () => {
            logger.info('Cleaning up old queue jobs...');
            try {
              await queueService.addCleanupJob({ daysOld: 7 });
            } catch (error) {
              logger.error('Queue cleanup failed:', error);
            }
          });

          // Cron: limpeza de audit logs
          cron.schedule('0 3 * * *', async () => {
            logger.info('Cleaning up old audit logs...');
            try {
              await auditService.deleteOldLogs(90);
            } catch (error) {
              logger.error('Audit cleanup failed:', error);
            }
          });

          logger.info('Background tasks initialized');
        } catch (error) {
          logger.error('Error in background tasks:', error);
        }
      })();
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error: any) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();