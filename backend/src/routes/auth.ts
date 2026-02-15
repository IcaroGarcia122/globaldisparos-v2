import { Router } from 'express';
import { User } from '../models';
import jwt from 'jsonwebtoken';
import config from '../config';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/login-supabase', async (req, res) => {
  try {
    const { email } = req.body;
    let user = await User.findOne({ where: { email } });

    if (!user) {
      // Se não existe, criar novo usuário
      user = await User.create({
        email,
        fullName: email.split('@')[0],
        password: Math.random().toString(36).slice(-20), // Senha aleatória
        role: 'user',
        isActive: true
      });
    }

    await user.update({ lastLoginAt: new Date() });
    const token = jwt.sign({ userId: user.id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, plan: user.plan } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    await user.update({ lastLoginAt: new Date() });
    const token = jwt.sign({ userId: user.id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, plan: user.plan } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(400).json({ error: 'Email já cadastrado' });
    const user = await User.create({ email, password, fullName });
    const token = jwt.sign({ userId: user.id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    res.status(201).json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, plan: user.plan } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await User.findByPk(req.user!.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role, plan: user.plan, planExpiresAt: user.planExpiresAt, isActive: user.isActive });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/users', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await User.findByPk(req.user!.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado. Apenas admins podem acessar.' });
    }

    const users = await User.findAll({
      attributes: ['id', 'email', 'fullName', 'role', 'plan', 'isActive', 'lastLoginAt', 'createdAt']
    });

    // Converter para formato compatível com o esperado pelo AdminDashboard (subscribers)
    const subscribers = users.map(u => ({
      id: u.id,
      name: u.fullName,
      email: u.email,
      phone: null,
      plan: u.plan === 'enterprise' ? 'anual' : u.plan === 'pro' ? 'trimestral' : 'mensal',
      status: u.isActive ? 'active' : 'inactive',
      price: u.plan === 'enterprise' ? 299.90 : u.plan === 'pro' ? 149.90 : 69.90,
      signup_date: u.createdAt?.toISOString() || new Date().toISOString(),
      last_login: u.lastLoginAt?.toISOString() || null,
      messages_sent: 0
    }));

    res.json(subscribers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
