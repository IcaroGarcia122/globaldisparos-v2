import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { authenticate, AuthRequest } from '../../middlewares/auth.middleware';
import { authLimiter } from '../../middlewares/rateLimiter';
import logger from '../../utils/logger';
import { sendPasswordReset, sendWelcome, sendInvite } from '../../services/email.service';

const router = Router();

/** POST /api/auth/login */
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
    });

    logger.info(`[Auth] Login: ${email}`);
    return res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, plan: user.plan } });
  } catch (err: any) {
    logger.error(`[Auth] Erro login: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/auth/register */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, plan } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ error: 'Email já cadastrado' });

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hash, fullName: fullName || email.split('@')[0], plan: plan || 'basic' },
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
    });

    // Enviar email de boas-vindas (não bloqueia a resposta)
    sendWelcome(user.email, user.fullName, user.plan).catch(() => {});

    return res.status(201).json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, plan: user.plan } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/auth/me */
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, fullName: true, role: true, plan: true, planExpiresAt: true, createdAt: true },
  });
  return res.json(user);
});

/** GET /api/auth/admin/users — admin only */
router.get('/admin/users', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, fullName: true, role: true, plan: true,
      isActive: true, createdAt: true, lastLoginAt: true, planExpiresAt: true,
      instances: { select: { totalMessagesSent: true, status: true } },
      campaigns: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const result = users.map(u => ({
    id: String(u.id),
    name: u.fullName,
    email: u.email,
    plan: u.plan,
    role: u.role,
    status: u.isActive ? 'active' : 'inactive',
    signup_date: u.createdAt.toISOString(),
    last_login: u.lastLoginAt?.toISOString() ?? null,
    plan_expires_at: u.planExpiresAt?.toISOString() ?? null,
    messages_sent: u.instances.reduce((s, i) => s + (i.totalMessagesSent || 0), 0),
    instances_count: u.instances.length,
    connected_instances: u.instances.filter(i => i.status === 'connected').length,
    campaigns_count: u.campaigns.length,
  }));

  return res.json(result);
});

/** PATCH /api/auth/admin/users/:id — alterar plano/status */
router.patch('/admin/users/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const { plan, isActive } = req.body;
  const update: any = {};
  if (plan !== undefined) update.plan = plan;
  if (isActive !== undefined) update.isActive = isActive;
  const user = await prisma.user.update({ where: { id: parseInt(req.params.id) }, data: update });
  return res.json({ ok: true, id: user.id, plan: user.plan, isActive: user.isActive });
});

/** DELETE /api/auth/admin/users/:id — remover usuário */
router.delete('/admin/users/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  await prisma.user.delete({ where: { id: parseInt(req.params.id) } });
  return res.json({ ok: true });
});

/** POST /api/auth/login-supabase — compatibilidade */
router.post('/login-supabase', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const hash = await bcrypt.hash(Math.random().toString(36), 10);
      user = await prisma.user.create({ data: { email, password: hash, fullName: email.split('@')[0] } });
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    return res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, plan: user.plan } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


/** POST /api/auth/admin/invite — gera link de convite */
router.post('/admin/invite', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const { plan = 'pro', note = '', expiresInDays = 7 } = req.body;

  const crypto = await import('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await prisma.$executeRaw`
    INSERT INTO invite_tokens (token, plan, created_by, expires_at, note)
    VALUES (${token}, ${plan}, ${req.user!.id}, ${expiresAt}, ${note})
  `;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const link = `${frontendUrl}/invite/${token}`;
  logger.info(`[Invite] Admin ${req.user!.id} gerou convite plano=${plan} expira=${expiresAt.toLocaleDateString('pt-BR')}`);

  // Se o admin informou um email no body, envia o convite direto
  const { email: inviteEmail } = req.body;
  if (inviteEmail) {
    sendInvite(inviteEmail, link, plan, note).catch(() => {});
  }

  return res.json({ token, link, plan, expiresAt, note, emailSent: !!inviteEmail });
});

/** GET /api/auth/invite/:token — valida token antes de mostrar o form */
router.get('/invite/:token', async (req: Request, res: Response) => {
  const rows: any[] = await prisma.$queryRaw`
    SELECT * FROM invite_tokens WHERE token = ${req.params.token} LIMIT 1
  `.catch(() => []);
  const invite = rows[0];
  if (!invite) return res.status(404).json({ error: 'Link inválido ou expirado' });
  if (invite.used_at) return res.status(410).json({ error: 'Este link já foi utilizado' });
  if (new Date(invite.expires_at) < new Date()) return res.status(410).json({ error: 'Link expirado' });
  return res.json({ valid: true, plan: invite.plan, note: invite.note });
});

/** POST /api/auth/invite/:token — cria conta via convite */
router.post('/invite/:token', async (req: Request, res: Response) => {
  const { email, password, fullName } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

  const rows: any[] = await prisma.$queryRaw`
    SELECT * FROM invite_tokens WHERE token = ${req.params.token} LIMIT 1
  `.catch(() => []);
  const invite = rows[0];
  if (!invite) return res.status(404).json({ error: 'Link inválido' });
  if (invite.used_at) return res.status(410).json({ error: 'Link já utilizado' });
  if (new Date(invite.expires_at) < new Date()) return res.status(410).json({ error: 'Link expirado' });

  // Verificar se o convite é restrito a um email específico
  // note pode conter "email:fulano@gmail.com" — se sim, só esse email pode usar
  const inviteNote = invite.note || '';
  const restrictedEmail = inviteNote.startsWith('email:') ? inviteNote.replace('email:', '').trim() : null;
  if (restrictedEmail && email.toLowerCase() !== restrictedEmail.toLowerCase()) {
    return res.status(403).json({ error: 'Este link de convite é exclusivo para outro email.' });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(400).json({ error: 'Email já cadastrado. Faça login normalmente.' });

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hash, fullName: fullName || email.split('@')[0], plan: invite.plan as any },
  });

  // Marcar token como usado IMEDIATAMENTE (uso único garantido)
  await prisma.$executeRaw\`
    UPDATE invite_tokens SET used_by = \${user.id}, used_at = NOW() WHERE token = \${req.params.token}
  \`;

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  });

  logger.info(`[Invite] Conta criada via convite: ${email} plano=${invite.plan}`);
  return res.status(201).json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, plan: user.plan } });
});

/** GET /api/auth/admin/invites — lista convites gerados */
router.get('/admin/invites', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const rows: any[] = await prisma.$queryRaw`
    SELECT it.*, u.email as used_by_email
    FROM invite_tokens it
    LEFT JOIN users u ON u.id = it.used_by
    WHERE it.created_by = ${req.user!.id}
    ORDER BY it.created_at DESC
    LIMIT 50
  `.catch(() => []);
  return res.json(rows);
});

/** POST /api/auth/forgot-password — solicitar reset */
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email obrigatório' });

  const user = await prisma.user.findUnique({ where: { email } });
  // Resposta sempre igual para não revelar se email existe
  if (!user) return res.json({ message: 'Se o email existir, você receberá o link.' });

  const crypto = await import('crypto');
  const token  = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h

  // Salvar token na tabela invite_tokens reutilizando para reset
  // Usar prefixo "reset_" no note para identificar
  await prisma.$executeRaw`
    INSERT INTO invite_tokens (token, plan, created_by, expires_at, note)
    VALUES (${token}, ${'basic'}, ${user.id}, ${expires}, ${'reset_password'})
    ON CONFLICT (token) DO NOTHING
  `.catch(() => {});

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink   = `${frontendUrl}/reset-password/${token}`;

  logger.info(`[Auth] Reset de senha solicitado para ${email}: ${resetLink}`);

  // Enviar email real via Resend
  const sent = await sendPasswordReset(email, resetLink, user.fullName);

  const isDev = process.env.NODE_ENV !== 'production';
  if (!sent) logger.warn(`[Auth] Email NÃO enviado para ${email} (Resend não configurado?)`);

  return res.json({
    message: 'Se o email estiver cadastrado, você receberá o link de redefinição.',
    ...(isDev ? { _dev_link: resetLink } : {}),
  });
});

/** POST /api/auth/reset-password/:token — efetivar reset */
router.post('/reset-password/:token', async (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Senha mínima de 6 caracteres' });

  const rows: any[] = await prisma.$queryRaw`
    SELECT * FROM invite_tokens
    WHERE token = ${req.params.token} AND note = ${'reset_password'} LIMIT 1
  `.catch(() => []);

  const row = rows[0];
  if (!row) return res.status(404).json({ error: 'Link inválido' });
  if (row.used_at) return res.status(410).json({ error: 'Link já utilizado' });
  if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: 'Link expirado (válido por 2h)' });

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: row.created_by }, data: { password: hash } });
  await prisma.$executeRaw`UPDATE invite_tokens SET used_at = NOW() WHERE token = ${req.params.token}`;

  logger.info(`[Auth] Senha redefinida para user ${row.created_by}`);
  return res.json({ message: 'Senha redefinida com sucesso. Faça login.' });
});

/** POST /api/auth/payment-token — gera token de pagamento válido por 30min
 *  Chamado pelo webhook do Diggion/Ironpay após compra aprovada
 *  Ou pode ser chamado pelo admin para liberar acesso manual
 */
router.post('/payment-token', async (req: Request, res: Response) => {
  const { plan, email, webhookSecret, transactionId } = req.body;

  // Validar secret do webhook (configurar no .env como WEBHOOK_SECRET)
  const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (expectedSecret && webhookSecret !== expectedSecret) {
    logger.warn(`[Payment] Tentativa com secret inválido`);
    return res.status(403).json({ error: 'Acesso negado' });
  }

  if (!plan) return res.status(400).json({ error: 'plan obrigatório' });

  const crypto   = await import('crypto');
  const token    = crypto.randomBytes(32).toString('hex');
  const expires  = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

  // Reusar tabela invite_tokens — note = 'payment' para identificar
  await prisma.$executeRaw`
    INSERT INTO invite_tokens (token, plan, created_by, expires_at, note)
    VALUES (${token}, ${plan}, ${1}, ${expires}, ${'payment:' + (transactionId || 'manual')})
    ON CONFLICT (token) DO NOTHING
  `.catch(() => {});

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const link = `${frontendUrl}/payment-approved?token=${token}&plan=${plan}`;

  logger.info(`[Payment] Token gerado para plano=${plan} email=${email || 'não informado'} tx=${transactionId || 'manual'}`);

  // Se veio email do comprador, enviar link direto
  if (email) {
    sendInvite(email, link, plan, 'Acesso liberado após compra').catch(() => {});
  }

  return res.json({ token, link, plan, expiresAt: expires });
});

/** GET /api/auth/validate-payment-token/:token — frontend valida antes de mostrar o form */
router.get('/validate-payment-token/:token', async (req: Request, res: Response) => {
  const rows: any[] = await prisma.$queryRaw`
    SELECT * FROM invite_tokens
    WHERE token = ${req.params.token}
    AND note LIKE ${'payment%'}
    LIMIT 1
  `.catch(() => []);

  const row = rows[0];
  if (!row) return res.status(404).json({ error: 'Link inválido' });
  if (row.used_at) return res.status(410).json({ error: 'Este link já foi utilizado' });
  if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: 'Link expirado. Solicite suporte.' });

  return res.json({ valid: true, plan: row.plan });
});

export default router;