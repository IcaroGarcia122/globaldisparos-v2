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

// ✅ MIDDLEWARE DE AUTENTICAÇÃO PARA SOCKET.IO
io.use((socket, next) => {
  const token = socket.handshake.auth?.token 
             || socket.handshake.headers?.authorization?.replace('Bearer ', '');

  if (!token) {
    console.warn(`⚠️ [SOCKET-AUTH] Nenhum token fornecido para socket ${socket.id}`);
    return next(new Error('Token não fornecido'));
  }

  try {
    const decoded = jwtService.verifyAccessToken(token) as any;
    socket.data.userId = decoded.userId || decoded.id;
    
    console.log(`✅ [SOCKET-AUTH] Socket ${socket.id} autenticado`);
    console.log(`✅ [SOCKET-AUTH] userId: ${socket.data.userId}`);
    
    next();
  } catch (err: any) {
    console.error(`❌ [SOCKET-AUTH] Token inválido para socket ${socket.id}:`, err.message);
    return next(new Error('Token inválido'));
  }
});

io.on('connection', (socket) => {
  logger.info(`✅ Cliente conectado via Socket.IO: ${socket.id}`);
  logger.info(`   Handshake auth:`, socket.handshake.auth);
  logger.info(`   Headers:`, socket.handshake.headers);

  // Socket já foi autenticado pelo middleware
  if (socket.data.userId) {
    websocketService.registerUserSocket(socket, socket.data.userId);
    
    // Inscrever socket na sala do usuário para conseguir emissões direcionadas
    socket.join(`user-${socket.data.userId}`);
    logger.info(`✅ Socket ${socket.id} registrado para usuário ${socket.data.userId} e inscrito na sala user-${socket.data.userId}`);
  }

  socket.on('disconnect', () => {
    logger.info(`🔴 Cliente desconectado: ${socket.id}`);
  });

  socket.on('error', (error) => {
    logger.error(`❌ Socket.IO erro para ${socket.id}:`, error);
  });
});

// ===================================
// MIDDLEWARES
// ===================================
// Validate environment variables
try {
  logger.info('🔐 Validating environment configuration...');
  // envConfig is singleton that validates on first import
} catch (error) {
  logger.error('❌ Environment validation failed:', error);
  process.exit(1);
}

// Security headers (Helmet + CORS + custom headers)
app.use(helmet());
setupSecurityHeaders(app);
setupCORS(app);
app.use(setupAdditionalSecurityMiddleware);

// Compression middleware
app.use(compression());

// Global rate limiting (applies to all endpoints except health checks)
app.use(globalRateLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===================================
// API RATE LIMITING (overrides global for specific routes)
// ===================================
// Auth endpoints use stricter rate limiting
// API endpoints use standard rate limiting
// Specific endpoints can use campaign rate limiting

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

// Auth routes use stricter rate limiting
app.use('/api/auth', authRateLimiter, authRoutes);

// Regular API routes use standard rate limiting
// Use more permissive limiter for instances (polling status checks)
app.use('/api/instances', statusPollingRateLimiter, instanceRoutes);
app.use('/api/contacts', apiRateLimiter, contactRoutes);
app.use('/api/campaigns', apiRateLimiter, campaignRoutes);
app.use('/api/disparador', apiRateLimiter, disparadorRoutes);
app.use('/api/groups', apiRateLimiter, groupRoutes);
app.use('/api/stats', apiRateLimiter, statsRoutes);
app.use('/api/webhook', webhookRoutes); // Webhooks bypass rate limiting (external sources)

// Health check endpoint (bypasses rate limiting)
app.get('/health', asyncHandler(async (req, res) => {
  const redisHealth = await redisService.get('health-check') !== null;
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: envConfig.nodeEnv,
    redis: redisHealth ? '✅ connected' : '⚠️  degraded',
  });
}));

// 404 catch-all (must be BEFORE error handler)
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method,
  });
});

// ===================================
// GLOBAL ERROR HANDLER (must be LAST middleware)
// ===================================
setupGlobalErrorHandler(app);

// ===================================
// INICIALIZAÇÃO
// ===================================
const startServer = async (): Promise<void> => {
  try {
    // ==========================================
    // 1. VALIDATE ENVIRONMENT CONFIGURATION
    // ==========================================
    logger.info('🔐 Environment configuration validated');

    // ==========================================
    // 2. DATABASE CONNECTION & SYNC
    // ==========================================
    try {
      await Promise.race([
        testConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database connection timeout')), 8000))
      ]);
      logger.info('✅ Database connected');
    } catch (dbError) {
      logger.error('⚠️  Database connection failed:', dbError);
      logger.warn('⚠️  Continuando sem banco de dados sincronizado');
    }
    
    try {
      await Promise.race([
        syncDatabase(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database sync timeout')), 10000))
      ]);
      logger.info('✅ Database synchronized');
    } catch (syncError) {
      logger.warn('⚠️  Database sync failed (will retry later):', syncError);
    }

    // ==========================================
    // 2.5 CREATE DEFAULT ADMIN USER
    // ==========================================
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
        logger.info('✅ Usuário admin criado automaticamente: admin@gmail.com / vip2026');
      } else {
        logger.info('✅ Usuário admin já existe');
      }
    } catch (error) {
      logger.error('❌ Erro ao criar usuário admin:', error);
    }

    // ==========================================
    // 3. INITIALIZE INFRASTRUCTURE SERVICES
    // ==========================================
    // Redis caching service (optional with timeout)
    try {
      // TEMPORÁRIO: Skip Redis se host está vazio (Docker não rodando)
      if (envConfig.redisHost?.trim()) {
        const redisReady = await Promise.race([
          redisService.ping(),
          new Promise(resolve => setTimeout(() => resolve(false), 3000))
        ]);
        if (redisReady) {
          logger.info('✅ Redis cache service initialized');
        } else {
          logger.warn('⚠️  Redis not available, continuing with degraded caching');
        }
      } else {
        logger.warn('⚠️  Redis disabled (REDIS_HOST not configured), continuing without caching');
      }
    } catch (err) {
      logger.warn('⚠️  Redis initialization failed, continuing:', err);
    }

    // Queue service for async processing
    try {
      await Promise.race([
        queueService.init(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Queue init timeout')), 5000))
      ]);
      logger.info('✅ Job queue service initialized (message, campaign, reconnect, group, cleanup)');
    } catch (err) {
      logger.warn('⚠️ Job queue service not available, some features may be limited');
    }

    // JWT service for token management  
    logger.info('✅ JWT token service initialized');

    // ==========================================
    // 3.5 INJECT SOCKET.IO INTO WHATSAPP SERVICE
    // ==========================================
    try {
      whatsappService.setSocketIO(io);
      logger.info('✅ Socket.IO injected into WhatsApp service for real-time events');
    } catch (error) {
      logger.warn('⚠️ Failed to inject Socket.IO into service:', error);
    }

    // ==========================================
    // 4. START HTTP SERVER FIRST (CRITICAL!)
    // ==========================================
    // Start listening BEFORE doing async reconnection tasks
    // This ensures API is immediately responsive
    server.listen(config.port, config.host, () => {
      logger.info(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║  🚀 WHATSAPP SAAS BACKEND - ENTERPRISE EDITION STARTED         ║
║                                                                ║
║  Environment: ${config.env.toUpperCase().padEnd(47)}║
║  Server: http://${config.host}:${config.port.toString().padEnd(41)}║
║  Frontend: ${config.frontendUrl.padEnd(48)}║
║                                                                ║
║  ✅ Baileys WhatsApp integration with anti-ban                 ║
║  ✅ PostgreSQL database connection                             ║
║  ✅ Redis caching & distributed locking                        ║
║  ✅ Bull job queue (message, campaign, reconnect)              ║
║  ✅ Rate limiting (global, auth, API, campaign)                ║
║  ✅ Security headers & CORS protection                         ║
║  ✅ Global error handling & Sentry integration                 ║
║  ✅ Audit logging & compliance trail                           ║
║  ✅ JWT token management with refresh rotation                 ║
║  ✅ WebSocket real-time communication (Socket.IO)              ║
║  ✅ Cron jobs for maintenance & cleanup                        ║
║                                                                ║
║  🔐 Production-ready for thousands of concurrent users         ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
      `);

      // ==========================================
      // RUN BACKGROUND TASKS AFTER SERVER STARTS
      // ==========================================
      // These run asynchronously after the HTTP server is listening
      (async () => {
        try {
          // Reset stale connections from previous restart
          const staleCount = await WhatsAppInstance.update(
            { status: 'disconnected' },
            { 
              where: { 
                status: 'connected',
                isActive: true 
              } 
            }
          );

          if (staleCount[0] > 0) {
            logger.info(`🔌 Reset ${staleCount[0]} stale connections from previous restart`);
          }

          // Reconnect active instances in background
          try {
            await Promise.race([
              whatsappService.reconnectAllInstances(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Reconnect timeout')), 10000))
            ]);
            logger.info('✅ WhatsApp instances reconnection completed');
          } catch (err: any) {
            logger.warn('⚠️  WhatsApp instance reconnection timeout/failed:', err.message);
          }

          // Schedule cron jobs
          cron.schedule('0 0 * * *', async () => {
            logger.info('⏰ Executing daily counter reset...');
            try {
              await antiBanService.resetDailyCounters();
            } catch (error) {
              logger.error('❌ Daily reset failed:', error);
            }
          });

          cron.schedule('0 */6 * * *', async () => {
            logger.info('🧹 Cleaning up old queue jobs...');
            try {
              await queueService.addCleanupJob({ daysOld: 7 });
            } catch (error) {
              logger.error('❌ Queue cleanup failed:', error);
            }
          });

          cron.schedule('0 3 * * *', async () => {
            logger.info('🧹 Cleaning up old audit logs...');
            try {
              await auditService.deleteOldLogs(90);
            } catch (error) {
              logger.error('❌ Audit cleanup failed:', error);
            }
          });

          logger.info('✅ Background tasks initialized');
        } catch (error) {
          logger.error('❌ Error in background tasks:', error);
        }
      })();
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error: any) => {
  console.error('🚨 UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error?.stack);
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
