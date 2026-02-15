import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Campaign, WhatsAppInstance } from '../models';
import antiBanService from '../services/antiBanService';

const router = Router();

router.get('/user', authenticate, async (req: AuthRequest, res) => {
  try {
    const instances = await WhatsAppInstance.findAll({ where: { userId: req.user!.id } });
    const campaigns = await Campaign.findAll({ where: { userId: req.user!.id } });
    const totalSent = instances.reduce((sum, i) => sum + i.totalMessagesSent, 0);
    const totalFailed = instances.reduce((sum, i) => sum + i.totalMessagesFailed, 0);
    res.json({
      totalInstances: instances.length,
      connectedInstances: instances.filter(i => i.status === 'connected').length,
      totalCampaigns: campaigns.length,
      runningCampaigns: campaigns.filter(c => c.status === 'running').length,
      totalMessagesSent: totalSent,
      totalMessagesFailed: totalFailed,
      successRate: totalSent > 0 ? ((totalSent / (totalSent + totalFailed)) * 100).toFixed(2) + '%' : '0%',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/instance/:id', authenticate, async (req, res) => {
  try {
    const info = await antiBanService.getAntiBanInfo(req.params.id);
    res.json(info);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
