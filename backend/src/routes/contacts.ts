import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ContactList, Contact } from '../models';

const router = Router();

router.post('/lists', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    const list = await ContactList.create({ userId: req.user!.id, name, description });
    res.status(201).json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/lists', authenticate, async (req: AuthRequest, res) => {
  try {
    const lists = await ContactList.findAll({ where: { userId: req.user!.id } });
    res.json(lists);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/lists/:id/contacts', authenticate, async (req: AuthRequest, res) => {
  try {
    const contacts = await Contact.findAll({ where: { contactListId: req.params.id }, limit: 50 });
    res.json({ contacts, pagination: { page: 1, limit: 50, total: contacts.length } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
