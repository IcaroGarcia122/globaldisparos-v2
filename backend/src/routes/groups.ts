import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import baileysService from '../services/baileysService';

const router = Router();

router.get('/sync/:instanceId', authenticate, async (req, res) => {
  try {
    const groups = await baileysService.getGroups(req.params.instanceId);
    res.json({ message: `${groups.length} grupos sincronizados`, groups });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:groupId/participants', authenticate, async (req, res) => {
  try {
    const { instanceId } = req.query;
    const participants = await baileysService.getGroupParticipants(instanceId as string, req.params.groupId);
    res.json({ groupId: req.params.groupId, participants, total: participants.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
