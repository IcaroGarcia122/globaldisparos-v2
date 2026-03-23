"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
exports.disconnectDB = disconnectDB;
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../utils/logger"));
const prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'query' }, 'error', 'warn']
        : ['error'],
});
if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
        if (process.env.LOG_QUERIES === 'true') {
            logger_1.default.debug(`[DB] ${e.query} (${e.duration}ms)`);
        }
    });
}
async function connectDB() {
    await prisma.$connect();
    logger_1.default.info('[DB] PostgreSQL conectado via Prisma');
}
async function disconnectDB() {
    await prisma.$disconnect();
}
exports.default = prisma;
//# sourceMappingURL=database.js.map