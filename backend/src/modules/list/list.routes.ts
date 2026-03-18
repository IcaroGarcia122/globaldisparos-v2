import { Router, Response } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../../middlewares/auth.middleware';
import prisma from '../../config/database';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
router.use(authenticate);

router.post('/lists', async (req: AuthRequest, res: Response) => {
  const list = await prisma.contactList.create({ data: { userId: req.user!.id, name: req.body.name, description: req.body.description } });
  return res.status(201).json(list);
});

router.get('/lists', async (req: AuthRequest, res: Response) => {
  const lists = await prisma.contactList.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' } });
  return res.json(lists);
});

router.get('/lists/:id/contacts', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const contacts = await prisma.contact.findMany({
    where: { contactListId: parseInt(req.params.id) },
    skip: (page - 1) * limit, take: limit,
  });
  const total = await prisma.contact.count({ where: { contactListId: parseInt(req.params.id) } });
  return res.json({ contacts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.post('/import-csv', upload.single('file'), async (req: AuthRequest, res: Response) => {
  return res.json({ message: 'Import via CSV disponível', imported: 0 });
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const lists = await prisma.contactList.findMany({ where: { userId: req.user!.id } });
  return res.json(lists);
});

export default router;
