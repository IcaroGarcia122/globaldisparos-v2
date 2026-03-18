import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: { id: number; email: string; role: string; plan: string };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const userId = decoded.userId || decoded.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, plan: true, isActive: true, planExpiresAt: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }

    // Verificar expiração do plano (admin nunca expira)
    if (user.role !== 'admin' && user.planExpiresAt && user.planExpiresAt < new Date()) {
      // Downgrade automático para basic
      await prisma.user.update({ where: { id: user.id }, data: { plan: 'basic' } }).catch(() => {});
      user.plan = 'basic' as any;
      logger.info(`[Auth] Plano expirado para user ${user.id} — rebaixado para basic`);
    }

    req.user = { id: user.id, email: user.email, role: user.role, plan: user.plan };
    next();
  } catch (err: any) {
    logger.warn(`[Auth] Token inválido: ${err.message}`);
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
}