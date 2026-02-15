import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Campaign } from '../models';
import campaignService from '../services/campaignService';

const router = Router();

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const campaign = await campaignService.createCampaign({ userId: req.user!.id, ...req.body });
    res.status(201).json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const campaigns = await Campaign.findAll({ where: { userId: req.user!.id } });
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/start', authenticate, async (req: AuthRequest, res) => {
  try {
    await campaignService.startCampaign(req.params.id);
    res.json({ message: 'Campanha iniciada' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/pause', authenticate, async (req: AuthRequest, res) => {
  try {
    await campaignService.pauseCampaign(req.params.id);
    res.json({ message: 'Campanha pausada' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/progress', authenticate, async (req: AuthRequest, res) => {
  try {
    const progress = await campaignService.getCampaignProgress(req.params.id);
    res.json(progress);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
