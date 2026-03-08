import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initSocket = (token: string): Socket => {
  if (socket && socket.connected) {
    return socket;
  }

  const socketUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

  socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
  });

  socket.on('connect', () => {
    console.log(`✅ Socket.IO conectado: ${socket?.id}`);
  });

  socket.on('disconnect', (reason) => {
    console.warn(`🔌 Socket.IO desconectado: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    console.error(`❌ Socket.IO erro de conexão:`, error.message);
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

// QR Code recebido via webhook
export const onQRCode = (callback: (data: { instanceId: number; qrCode: string }) => void) => {
  if (!socket) return;
  socket.off('qr_code');
  socket.on('qr_code', callback);
};

// Instância conectada — escuta AMBOS os eventos que o backend pode emitir
export const onInstanceConnected = (callback: (data: { instanceId: number; phoneNumber?: string }) => void) => {
  if (!socket) return;
  socket.off('whatsapp_connected');
  socket.off('instance_connected');
  // Evento principal que o webhook.ts emite
  socket.on('whatsapp_connected', (data: any) => {
    callback({ instanceId: data.instanceId, phoneNumber: data.phoneNumber });
  });
  // Fallback
  socket.on('instance_connected', (data: any) => {
    callback({ instanceId: data.instanceId, phoneNumber: data.phoneNumber });
  });
};

// Instância desconectada
export const onInstanceDisconnected = (callback: (data: { instanceId: number }) => void) => {
  if (!socket) return;
  socket.off('whatsapp_disconnected');
  socket.on('whatsapp_disconnected', callback);
};

export const removeInstanceConnectedListener = () => {
  if (!socket) return;
  socket.off('whatsapp_connected');
  socket.off('instance_connected');
};

export const removeQRCodeListener = () => {
  if (!socket) return;
  socket.off('qr_code');
};

// Alias para compatibilidade com ConnectWhatsAPP.tsx
export const removeQRListener = removeQRCodeListener;

export const waitForSocketConnection = (timeout = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (socket?.connected) { resolve(); return; }
    const timer = setTimeout(() => reject(new Error('Socket connection timeout')), timeout);
    socket?.once('connect', () => { clearTimeout(timer); resolve(); });
    socket?.once('connect_error', (err) => { clearTimeout(timer); reject(err); });
  });
};

export const removeAllListeners = () => {
  if (!socket) return;
  socket.off('whatsapp_connected');
  socket.off('instance_connected');
  socket.off('whatsapp_disconnected');
  socket.off('qr_code');
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};