import { io, Socket } from 'socket.io-client';
import logger from './logger';

let socket: Socket | null = null;

export const initSocket = (token: string): Socket => {
  if (socket && socket.connected) {
    logger.info(`♻️ Socket.IO já conectado: ${socket.id}`);
    return socket;
  }

  const socketUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

  socket = io(socketUrl, {
    auth: {
      token: token,  // ✅ Token no auth (correto para autenticação)
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    logger.info(`✅ Socket.IO conectado com sucesso: ${socket?.id}`);
    logger.info(`✅ Token autenticado no servidor`);
  });

  socket.on('disconnect', (reason) => {
    logger.warn(`🔌 Socket.IO desconectado: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    logger.error(`❌ Erro Socket.IO (auth falhou?):`, error);
  });

  socket.on('error', (error) => {
    logger.error(`❌ Erro Socket.IO:`, error);
  });

  return socket;
};

export const waitForSocketConnection = (): Promise<Socket> => {
  return new Promise((resolve, reject) => {
    if (socket && socket.connected) {
      logger.info(`✅ Socket.IO já está conectado`);
      resolve(socket);
      return;
    }

    if (!socket) {
      reject(new Error('Socket não inicializado'));
      return;
    }

    // Aguardar conexão
    const timeout = setTimeout(() => {
      reject(new Error('Timeout aguardando Socket.IO'));
    }, 10000);

    socket.once('connect', () => {
      clearTimeout(timeout);
      logger.info(`✅ Socket.IO conectado após await`);
      resolve(socket);
    });
  });
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket?.connected) {
    socket.disconnect();
    socket = null;
  }
};

export const onQRCode = (callback: (data: { instanceId: number; qrCode: string }) => void) => {
  if (!socket) {
    logger.warn('Socket não inicializado');
    return;
  }
  // Remove listeners antigos antes de adicionar novo
  socket.off('qr');
  socket.on('qr', callback);
};

export const onInstanceConnected = (callback: (data: { instanceId: number; phoneNumber: string }) => void) => {
  if (!socket) {
    logger.warn('Socket não inicializado');
    return;
  }
  // Remove listeners antigos antes de adicionar novo
  socket.off('instance_connected');
  socket.on('instance_connected', callback);
};

export const onInstanceDisconnected = (callback: (data: { instanceId: number; reason: string }) => void) => {
  if (!socket) {
    logger.warn('Socket não inicializado');
    return;
  }
  // Remove listeners antigos antes de adicionar novo
  socket.off('instance_disconnected');
  socket.on('instance_disconnected', callback);
};

export const removeQRListener = () => {
  if (socket) {
    socket.off('qr');
  }
};

export const removeInstanceConnectedListener = () => {
  if (socket) {
    socket.off('instance_connected');
  }
};

export const removeInstanceDisconnectedListener = () => {
  if (socket) {
    socket.off('instance_disconnected');
  }
};
