"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketServer = setupSocketServer;
exports.getIO = getIO;
exports.emitToUser = emitToUser;
exports.emitToCampaign = emitToCampaign;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = __importDefault(require("../utils/logger"));
let io;
function setupSocketServer(server) {
    io = new socket_io_1.Server(server, {
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
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.replace('Bearer ', '');
        if (!token) {
            socket.data.userId = null;
            return next();
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            socket.data.userId = decoded.userId || decoded.id;
            next();
        }
        catch {
            socket.data.userId = null;
            next();
        }
    });
    io.on('connection', (socket) => {
        const userId = socket.data.userId;
        if (userId) {
            // Registra em ambos os formatos que o frontend usa
            socket.join(`user:${userId}`);
            socket.join(`user-${userId}`);
            logger_1.default.info(`[Socket] User ${userId} conectado: ${socket.id}`);
        }
        socket.on('join', (room) => {
            socket.join(room);
        });
        socket.on('disconnect', () => {
            if (userId)
                logger_1.default.info(`[Socket] User ${userId} desconectado`);
        });
    });
    return io;
}
function getIO() {
    if (!io)
        throw new Error('Socket.IO não inicializado');
    return io;
}
/** Emite evento para um usuário específico */
function emitToUser(userId, event, data) {
    if (!io)
        return;
    io.to(`user:${userId}`).to(`user-${userId}`).emit(event, data);
}
/** Emite evento para uma sala de campanha */
function emitToCampaign(campaignId, event, data) {
    if (!io)
        return;
    io.to(`campaign:${campaignId}`).emit(event, data);
}
//# sourceMappingURL=socket.server.js.map