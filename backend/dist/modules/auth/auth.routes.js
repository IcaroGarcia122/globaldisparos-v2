"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../../config/database"));
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rateLimiter_1 = require("../../middlewares/rateLimiter");
const logger_1 = __importDefault(require("../../utils/logger"));
const email_service_1 = require("../../services/email.service");
const router = (0, express_1.Router)();
/** POST /api/auth/login */
router.post('/login', rateLimiter_1.authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        const user = await database_1.default.user.findUnique({ where: { email } });
        if (!user)
            return res.status(401).json({ error: 'Credenciais inválidas' });
        const valid = await bcryptjs_1.default.compare(password, user.password);
        if (!valid)
            return res.status(401).json({ error: 'Credenciais inválidas' });
        await database_1.default.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, {
            expiresIn: (process.env.JWT_EXPIRES_IN || '7d'),
        });
        logger_1.default.info(`[Auth] Login: ${email}`);
        return res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, plan: user.plan } });
    }
    catch (err) {
        logger_1.default.error(`[Auth] Erro login: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});
/** POST /api/auth/register */
router.post('/register', async (req, res) => {
    try {
        const { email, password, fullName, plan } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        const exists = await database_1.default.user.findUnique({ where: { email } });
        if (exists)
            return res.status(400).json({ error: 'Email já cadastrado' });
        const hash = await bcryptjs_1.default.hash(password, 10);
        const user = await database_1.default.user.create({
            data: { email, password: hash, fullName: fullName || email.split('@')[0], plan: plan || 'basic' },
        });
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, {
            expiresIn: (process.env.JWT_EXPIRES_IN || '7d'),
        });
        // Enviar email de boas-vindas (não bloqueia a resposta)
        (0, email_service_1.sendWelcome)(user.email, user.fullName, user.plan).catch(() => { });
        return res.status(201).json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, plan: user.plan } });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/** GET /api/auth/me */
router.get('/me', auth_middleware_1.authenticate, async (req, res) => {
    const user = await database_1.default.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, fullName: true, role: true, plan: true, planExpiresAt: true, createdAt: true },
    });
    return res.json(user);
});
/** GET /api/auth/admin/users — admin only */
router.get('/admin/users', auth_middleware_1.authenticate, async (req, res) => {
    if (req.user.role !== 'admin')
        return res.status(403).json({ error: 'Acesso negado' });
    const users = await database_1.default.user.findMany({
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
router.patch('/admin/users/:id', auth_middleware_1.authenticate, async (req, res) => {
    if (req.user.role !== 'admin')
        return res.status(403).json({ error: 'Acesso negado' });
    const { plan, isActive } = req.body;
    const update = {};
    if (plan !== undefined)
        update.plan = plan;
    if (isActive !== undefined)
        update.isActive = isActive;
    const user = await database_1.default.user.update({ where: { id: parseInt(req.params.id) }, data: update });
    return res.json({ ok: true, id: user.id, plan: user.plan, isActive: user.isActive });
});
/** DELETE /api/auth/admin/users/:id — remover usuário */
router.delete('/admin/users/:id', auth_middleware_1.authenticate, async (req, res) => {
    if (req.user.role !== 'admin')
        return res.status(403).json({ error: 'Acesso negado' });
    const userId = parseInt(req.params.id);
    try {
        // Remover FKs antes de deletar usuário
        // Limpar FKs em ordem correta antes de deletar usuário
        await database_1.default.$executeRaw `UPDATE invite_tokens SET used_by = NULL WHERE used_by = ${userId}`.catch(() => { });
        await database_1.default.$executeRaw `DELETE FROM invite_tokens WHERE created_by = ${userId}`.catch(() => { });
        await database_1.default.campaign.deleteMany({ where: { userId } }).catch(() => { });
        await database_1.default.whatsAppInstance.updateMany({ where: { userId }, data: { isActive: false, status: 'disconnected' } }).catch(() => { });
        await database_1.default.user.delete({ where: { id: userId } });
        return res.json({ ok: true });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/** POST /api/auth/login-supabase — compatibilidade */
router.post('/login-supabase', async (req, res) => {
    try {
        const { email } = req.body;
        let user = await database_1.default.user.findUnique({ where: { email } });
        if (!user) {
            const hash = await bcryptjs_1.default.hash(Math.random().toString(36), 10);
            user = await database_1.default.user.create({ data: { email, password: hash, fullName: email.split('@')[0] } });
        }
        await database_1.default.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        return res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, plan: user.plan } });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/** POST /api/auth/admin/invite — gera link de convite */
router.post('/admin/invite', auth_middleware_1.authenticate, async (req, res) => {
    if (req.user.role !== 'admin')
        return res.status(403).json({ error: 'Acesso negado' });
    const { plan = 'pro', note = '', expiresInDays = 7 } = req.body;
    const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    await database_1.default.$executeRaw `
    INSERT INTO invite_tokens (token, plan, created_by, expires_at, note)
    VALUES (${token}, ${plan}, ${req.user.id}, ${expiresAt}, ${note})
  `;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/invite/${token}`;
    logger_1.default.info(`[Invite] Admin ${req.user.id} gerou convite plano=${plan} expira=${expiresAt.toLocaleDateString('pt-BR')}`);
    // Se o admin informou um email no body, envia o convite direto
    const { email: inviteEmail } = req.body;
    if (inviteEmail) {
        (0, email_service_1.sendInvite)(inviteEmail, link, plan, note).catch(() => { });
    }
    return res.json({ token, link, plan, expiresAt, note, emailSent: !!inviteEmail });
});
/** GET /api/auth/invite/:token — valida token antes de mostrar o form */
router.get('/invite/:token', async (req, res) => {
    const rows = await database_1.default.$queryRaw `
    SELECT * FROM invite_tokens WHERE token = ${req.params.token} LIMIT 1
  `.catch(() => []);
    const invite = rows[0];
    if (!invite)
        return res.status(404).json({ error: 'Link inválido ou expirado' });
    if (invite.used_at)
        return res.status(410).json({ error: 'Este link já foi utilizado' });
    if (new Date(invite.expires_at) < new Date())
        return res.status(410).json({ error: 'Link expirado' });
    return res.json({ valid: true, plan: invite.plan, note: invite.note });
});
/** POST /api/auth/invite/:token — cria conta via convite */
router.post('/invite/:token', async (req, res) => {
    const { email, password, fullName } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'Email e senha obrigatórios' });
    const rows = await database_1.default.$queryRaw `
    SELECT * FROM invite_tokens WHERE token = ${req.params.token} LIMIT 1
  `.catch(() => []);
    const invite = rows[0];
    if (!invite)
        return res.status(404).json({ error: 'Link inválido' });
    if (invite.used_at)
        return res.status(410).json({ error: 'Link já utilizado' });
    if (new Date(invite.expires_at) < new Date())
        return res.status(410).json({ error: 'Link expirado' });
    // Verificar se o convite é restrito a um email específico
    // note pode conter "email:fulano@gmail.com" — se sim, só esse email pode usar
    const inviteNote = invite.note || '';
    const restrictedEmail = inviteNote.startsWith('email:') ? inviteNote.replace('email:', '').trim() : null;
    if (restrictedEmail && email.toLowerCase() !== restrictedEmail.toLowerCase()) {
        return res.status(403).json({ error: 'Este link de convite é exclusivo para outro email.' });
    }
    const exists = await database_1.default.user.findUnique({ where: { email } });
    if (exists)
        return res.status(400).json({ error: 'Email já cadastrado. Faça login normalmente.' });
    const hash = await bcryptjs_1.default.hash(password, 10);
    // Calcular expiração do plano baseado no tipo do convite
    const planDaysMap = { mensal: 30, trimestral: 90, anual: 365, pro: 30, basic: 7, enterprise: 90 };
    const planDays = planDaysMap[invite.plan] || 30;
    const planExpiresAt = new Date(Date.now() + planDays * 24 * 60 * 60 * 1000);
    const user = await database_1.default.user.create({
        data: { email, password: hash, fullName: fullName || email.split('@')[0], plan: invite.plan, planExpiresAt },
    });
    const inviteToken = req.params.token;
    await database_1.default.$executeRaw `
    UPDATE invite_tokens SET used_by = ${user.id}, used_at = NOW() WHERE token = ${inviteToken}
  `;
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: (process.env.JWT_EXPIRES_IN || '7d'),
    });
    logger_1.default.info(`[Invite] Conta criada via convite: ${email} plano=${invite.plan}`);
    return res.status(201).json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, plan: user.plan, planExpiresAt: user.planExpiresAt } });
});
/** GET /api/auth/admin/invites — lista convites gerados */
router.get('/admin/invites', auth_middleware_1.authenticate, async (req, res) => {
    if (req.user.role !== 'admin')
        return res.status(403).json({ error: 'Acesso negado' });
    const rows = await database_1.default.$queryRaw `
    SELECT it.*, u.email as used_by_email
    FROM invite_tokens it
    LEFT JOIN users u ON u.id = it.used_by
    WHERE it.created_by = ${req.user.id}
    ORDER BY it.created_at DESC
    LIMIT 50
  `.catch(() => []);
    return res.json(rows);
});
/** POST /api/auth/forgot-password — solicitar reset */
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email)
        return res.status(400).json({ error: 'Email obrigatório' });
    const user = await database_1.default.user.findUnique({ where: { email } });
    // Resposta sempre igual para não revelar se email existe
    if (!user)
        return res.json({ message: 'Se o email existir, você receberá o link.' });
    const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h
    // Salvar token na tabela invite_tokens reutilizando para reset
    // Usar prefixo "reset_" no note para identificar
    const planBasic = 'basic';
    const noteReset = 'reset_password';
    await database_1.default.$executeRaw `
    INSERT INTO invite_tokens (token, plan, created_by, expires_at, note)
    VALUES (${token}, ${planBasic}, ${user.id}, ${expires}, ${noteReset})
    ON CONFLICT (token) DO NOTHING
  `.catch(() => { });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password/${token}`;
    logger_1.default.info(`[Auth] Reset de senha solicitado para ${email}: ${resetLink}`);
    // Enviar email real via Resend
    const sent = await (0, email_service_1.sendPasswordReset)(email, resetLink, user.fullName);
    const isDev = process.env.NODE_ENV !== 'production';
    if (!sent)
        logger_1.default.warn(`[Auth] Email NÃO enviado para ${email} (Resend não configurado?)`);
    return res.json({
        message: 'Se o email estiver cadastrado, você receberá o link de redefinição.',
        ...(isDev ? { _dev_link: resetLink } : {}),
    });
});
/** POST /api/auth/reset-password/:token — efetivar reset */
router.post('/reset-password/:token', async (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 6)
        return res.status(400).json({ error: 'Senha mínima de 6 caracteres' });
    const rows = await database_1.default.$queryRaw `
    SELECT * FROM invite_tokens
    WHERE token = ${req.params.token} AND note = ${'reset_password'} LIMIT 1
  `.catch(() => []);
    const row = rows[0];
    if (!row)
        return res.status(404).json({ error: 'Link inválido' });
    if (row.used_at)
        return res.status(410).json({ error: 'Link já utilizado' });
    if (new Date(row.expires_at) < new Date())
        return res.status(410).json({ error: 'Link expirado (válido por 2h)' });
    const hash = await bcryptjs_1.default.hash(password, 10);
    await database_1.default.user.update({ where: { id: row.created_by }, data: { password: hash } });
    await database_1.default.$executeRaw `UPDATE invite_tokens SET used_at = NOW() WHERE token = ${req.params.token}`;
    logger_1.default.info(`[Auth] Senha redefinida para user ${row.created_by}`);
    return res.json({ message: 'Senha redefinida com sucesso. Faça login.' });
});
/** POST /api/auth/validate-payment-ref — valida o ref da IronPay no servidor (ref nunca exposto no bundle) */
router.post('/validate-payment-ref', async (req, res) => {
    const { ref, plan } = req.body;
    const expectedRef = process.env.PAYMENT_REF;
    if (!expectedRef) {
        logger_1.default.warn('[Payment] PAYMENT_REF não configurado no .env');
        return res.status(503).json({ error: 'Configuração ausente' });
    }
    if (!ref || ref !== expectedRef) {
        logger_1.default.warn('[Payment] Tentativa com ref inválido');
        return res.status(403).json({ error: 'Acesso não autorizado' });
    }
    return res.json({ valid: true, plan: plan || 'mensal' });
});
/** POST /api/auth/payment-token — gera token de pagamento válido por 30min
 *  Pode ser chamado pelo admin para liberar acesso manual ou por webhook de pagamento
 */
router.post('/payment-token', async (req, res) => {
    const { plan, email, webhookSecret, transactionId } = req.body;
    // Validar secret do webhook (configurar no .env como WEBHOOK_SECRET)
    const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!expectedSecret) {
        logger_1.default.error('[Payment] PAYMENT_WEBHOOK_SECRET não configurado — endpoint bloqueado por segurança');
        return res.status(503).json({ error: 'Serviço não configurado' });
    }
    if (webhookSecret !== expectedSecret) {
        logger_1.default.warn(`[Payment] Tentativa com secret inválido`);
        return res.status(403).json({ error: 'Acesso negado' });
    }
    if (!plan)
        return res.status(400).json({ error: 'plan obrigatório' });
    const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
    // Reusar tabela invite_tokens — note = 'payment' para identificar
    await database_1.default.$executeRaw `
    INSERT INTO invite_tokens (token, plan, created_by, expires_at, note)
    VALUES (${token}, ${plan}, ${1}, ${expires}, ${('payment:' + (transactionId || 'manual'))})
    ON CONFLICT (token) DO NOTHING
  `.catch(() => { });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/payment-approved?token=${token}&plan=${plan}`;
    logger_1.default.info(`[Payment] Token gerado para plano=${plan} email=${email || 'não informado'} tx=${transactionId || 'manual'}`);
    // Se veio email do comprador, enviar link direto
    if (email) {
        (0, email_service_1.sendInvite)(email, link, plan, 'Acesso liberado após compra').catch(() => { });
    }
    return res.json({ token, link, plan, expiresAt: expires });
});
/** GET /api/auth/validate-payment-token/:token — frontend valida antes de mostrar o form */
router.get('/validate-payment-token/:token', async (req, res) => {
    const rows = await database_1.default.$queryRaw `
    SELECT * FROM invite_tokens
    WHERE token = ${req.params.token}
    AND note LIKE ${'payment%'}
    LIMIT 1
  `.catch(() => []);
    const row = rows[0];
    if (!row)
        return res.status(404).json({ error: 'Link inválido' });
    if (row.used_at)
        return res.status(410).json({ error: 'Este link já foi utilizado' });
    if (new Date(row.expires_at) < new Date())
        return res.status(410).json({ error: 'Link expirado. Solicite suporte.' });
    return res.json({ valid: true, plan: row.plan });
});
/** GET /api/admin/logs — últimas linhas de log para o painel admin */
router.get('/admin/logs', auth_middleware_1.authenticate, async (req, res) => {
    if (req.user.role !== 'admin')
        return res.status(403).json({ error: 'Acesso negado' });
    try {
        const { execSync } = require('child_process');
        const out = execSync('tail -n 200 /root/.pm2/logs/globaldisparos-out.log 2>/dev/null || echo ""').toString();
        const err = execSync('tail -n 50 /root/.pm2/logs/globaldisparos-error.log 2>/dev/null || echo ""').toString();
        const combined = [...out.split('\n'), ...err.split('\n')]
            .filter(l => l.trim())
            .map(l => l.replace(/^0\|globaldi \| /, ''))
            .slice(-150);
        return res.json({ logs: combined });
    }
    catch {
        return res.json({ logs: ['Erro ao ler logs'] });
    }
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map