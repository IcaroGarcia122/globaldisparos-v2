import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { Server } from 'socket.io';
import http from 'http';
import config from './config';
import logger from './utils/logger';
import { testConnection, syncDatabase } from './config/database';
import baileysService from './services/baileysService';
import antiBanService from './services/antiBanService';
import cron from 'node-cron';

const app: Express = express();
const server = http.createServer(app);

// ===================================
// SOCKET.IO
// ===================================
export const io = new Server(server, {
  cors: {
    origin: config.frontendUrl,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  logger.info(`Cliente conectado: ${socket.id}`);

  socket.on('disconnect', () => {
    logger.info(`Cliente desconectado: ${socket.id}`);
  });
});

// ===================================
// MIDDLEWARES
// ===================================
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
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
import statsRoutes from './routes/stats';
import webhookRoutes from './routes/webhook';

app.use('/api/auth', authRoutes);
app.use('/api/instances', instanceRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/webhook', webhookRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ===================================
// CRON JOBS
// ===================================
// Reset contadores diários às 00:00
cron.schedule('0 0 * * *', async () => {
  logger.info('🔄 Executando reset de contadores diários...');
  await antiBanService.resetDailyCounters();
});

// ===================================
// INICIALIZAÇÃO
// ===================================
const startServer = async (): Promise<void> => {
  try {
    // Testa conexão com o banco
    await testConnection();

    // Sincroniza modelos
    await syncDatabase();

    // Reconecta instâncias ativas
    await baileysService.reconnectAllInstances();

    // Inicia servidor
    server.listen(config.port, config.host, () => {
      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        🚀 WHATSAPP SAAS BACKEND - RODANDO!               ║
║                                                           ║
║  Ambiente: ${config.env.padEnd(48)}║
║  Servidor: http://${config.host}:${config.port.toString().padEnd(36)}║
║  Frontend: ${config.frontendUrl.padEnd(48)}║
║                                                           ║
║  ✅ Baileys integrado com sistema anti-ban               ║
║  ✅ PostgreSQL conectado                                 ║
║  ✅ WebSocket ativo                                      ║
║  ✅ Cron jobs agendados                                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
