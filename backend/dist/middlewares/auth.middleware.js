"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireAdmin = requireAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../utils/logger"));
async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.id;
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, role: true, plan: true, isActive: true, planExpiresAt: true },
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
        }
        // Verificar expiração do plano (admin nunca expira)
        if (user.role !== 'admin' && user.planExpiresAt && user.planExpiresAt < new Date()) {
            // Downgrade automático para basic
            await database_1.default.user.update({ where: { id: user.id }, data: { plan: 'basic' } }).catch(() => { });
            user.plan = 'basic';
            logger_1.default.info(`[Auth] Plano expirado para user ${user.id} — rebaixado para basic`);
        }
        req.user = { id: user.id, email: user.email, role: user.role, plan: user.plan };
        next();
    }
    catch (err) {
        logger_1.default.warn(`[Auth] Token inválido: ${err.message}`);
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
}
function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso restrito a administradores' });
    }
    next();
}
//# sourceMappingURL=auth.middleware.js.map