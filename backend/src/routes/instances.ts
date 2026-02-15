import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { WhatsAppInstance } from '../models';
import baileysService from '../services/baileysService';

const router = Router();

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, accountAge } = req.body;
    const instance = await WhatsAppInstance.create({ userId: req.user!.id, name, accountAge: accountAge || 0 });
    res.status(201).json(instance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const instances = await WhatsAppInstance.findAll({ where: { userId: req.user!.id } });
    res.json(instances);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/qr', authenticate, async (req: AuthRequest, res) => {
  try {
    const qrCode = baileysService.getQRCode(req.params.id);
    if (!qrCode) return res.status(404).json({ error: 'QR Code não disponível' });
    res.json({ qrCode });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/connect', authenticate, async (req: AuthRequest, res) => {
  try {
    await baileysService.connect(req.params.id);
    res.json({ message: 'Conectando... Escaneie o QR Code' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    await baileysService.disconnect(req.params.id);
    await WhatsAppInstance.destroy({ where: { id: req.params.id, userId: req.user!.id } });
    res.json({ message: 'Instância desconectada' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
