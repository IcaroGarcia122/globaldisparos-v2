import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

let io: Server;

export function setupSocketServer(server: any): Server {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    path: '/socket.io/',
    serveClient: false,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Autenticação do socket
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      socket.data.userId = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      socket.data.userId = decoded.userId || decoded.id;
      next();
    } catch {
      socket.data.userId = null;
      next();
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    if (userId) {
      // Registra em ambos os formatos que o frontend usa
      socket.join(`user:${userId}`);
      socket.join(`user-${userId}`);
      logger.info(`[Socket] User ${userId} conectado: ${socket.id}`);
    }

    socket.on('join', (room: string) => {
      socket.join(room);
    });

    socket.on('disconnect', () => {
      if (userId) logger.info(`[Socket] User ${userId} desconectado`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO não inicializado');
  return io;
}

/** Emite evento para um usuário específico */
export function emitToUser(userId: number, event: string, data: any) {
  if (!io) return;
  io.to(`user:${userId}`).to(`user-${userId}`).emit(event, data);
}

/** Emite evento para uma sala de campanha */
export function emitToCampaign(campaignId: number, event: string, data: any) {
  if (!io) return;
  io.to(`campaign:${campaignId}`).emit(event, data);
}
