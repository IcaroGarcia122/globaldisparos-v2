import { Router, Response } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../../middlewares/auth.middleware';
import prisma from '../../config/database';
import { getParticipants } from '../../services/groups.service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.use(authenticate);

/** POST /contacts/lists — criar lista */
router.post('/lists', async (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  const list = await prisma.contactList.create({
    data: { userId: req.user!.id, name: name.trim(), description: description?.trim() || null },
  });
  return res.status(201).json(list);
});

/** GET /contacts/lists — listar com contagem */
router.get('/lists', async (req: AuthRequest, res: Response) => {
  const lists = await prisma.contactList.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { contacts: true } } },
  });
  return res.json(lists);
});

/** DELETE /contacts/lists/:id */
router.delete('/lists/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const list = await prisma.contactList.findUnique({ where: { id }, select: { userId: true } });
  if (!list) return res.status(404).json({ error: 'Lista não encontrada' });
  if (list.userId !== req.user!.id) return res.status(403).json({ error: 'Acesso negado' });
  await prisma.contact.deleteMany({ where: { contactListId: id } });
  await prisma.contactList.delete({ where: { id } });
  return res.json({ deleted: true });
});

/** GET /contacts/lists/:id/contacts — paginado */
router.get('/lists/:id/contacts', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const list = await prisma.contactList.findUnique({ where: { id }, select: { userId: true, name: true } });
  if (!list) return res.status(404).json({ error: 'Lista não encontrada' });
  if (list.userId !== req.user!.id) return res.status(403).json({ error: 'Acesso negado' });
  const page  = parseInt(req.query.page  as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where: { contactListId: id },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.contact.count({ where: { contactListId: id } }),
  ]);
  return res.json({ contacts, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, listName: list.name });
});

/** POST /contacts/lists/:id/import-csv — importar CSV para lista */
router.post('/lists/:id/import-csv', upload.single('file'), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const list = await prisma.contactList.findUnique({ where: { id }, select: { userId: true } });
  if (!list) return res.status(404).json({ error: 'Lista não encontrada' });
  if (list.userId !== req.user!.id) return res.status(403).json({ error: 'Acesso negado' });
  if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório' });

  try {
    // Remove BOM e normaliza quebras de linha
    const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines   = content.split(/\r?\n/).filter(l => l.trim());

    const toInsert: { phoneNumber: string; name?: string }[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      const tokens = line.split(/[,;\t]/);
      for (let ti = 0; ti < tokens.length; ti++) {
        const digits = tokens[ti].replace(/[^0-9]/g, '').trim();
        if (digits.length >= 8 && digits.length <= 15 && !seen.has(digits)) {
          seen.add(digits);
          // tenta extrair nome de coluna adjacente
          const prev = tokens[ti - 1]?.replace(/["']/g, '').trim();
          const name = prev && /[a-zA-ZÀ-ÿ]/.test(prev) && prev.length > 1 ? prev : undefined;
          toInsert.push({ phoneNumber: digits, name });
        }
      }
    }

    if (toInsert.length === 0) return res.status(400).json({ error: 'Nenhum número válido encontrado no arquivo' });

    let imported = 0;
    for (const c of toInsert) {
      await prisma.contact.upsert({
        where: { contactListId_phoneNumber: { contactListId: id, phoneNumber: c.phoneNumber } },
        update: {},
        create: { contactListId: id, phoneNumber: c.phoneNumber, name: c.name },
      }).catch(() => {});
      imported++;
    }

    return res.json({ imported, total: toInsert.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST /contacts/lists/:id/import-from-group — importar participantes de grupo para lista */
router.post('/lists/:id/import-from-group', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { instanceId, groupId } = req.body;
  if (!instanceId || !groupId) return res.status(400).json({ error: 'instanceId e groupId obrigatórios' });

  const list = await prisma.contactList.findUnique({ where: { id }, select: { userId: true, name: true } });
  if (!list) return res.status(404).json({ error: 'Lista não encontrada' });
  if (list.userId !== req.user!.id) return res.status(403).json({ error: 'Acesso negado' });

  try {
    const { participants } = await getParticipants(parseInt(String(instanceId)), groupId);
    if (participants.length === 0) return res.status(404).json({ error: 'Nenhum participante encontrado no grupo' });

    let imported = 0;
    for (const phone of participants) {
      await prisma.contact.upsert({
        where: { contactListId_phoneNumber: { contactListId: id, phoneNumber: phone } },
        update: {},
        create: { contactListId: id, phoneNumber: phone },
      }).catch(() => {});
      imported++;
    }

    return res.json({ imported, total: participants.length, listName: list.name });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** GET /contacts/lists/:id/export-csv — exportar lista como CSV */
router.get('/lists/:id/export-csv', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const list = await prisma.contactList.findUnique({ where: { id }, select: { userId: true, name: true } });
  if (!list) return res.status(404).json({ error: 'Lista não encontrada' });
  if (list.userId !== req.user!.id) return res.status(403).json({ error: 'Acesso negado' });

  const contacts = await prisma.contact.findMany({ where: { contactListId: id }, orderBy: { createdAt: 'asc' } });
  const rows = [['#', 'Telefone', 'Nome', 'Numero_Whatsapp']];
  contacts.forEach((c, i) => {
    rows.push([(i + 1).toString(), c.phoneNumber, c.name || '', `+${c.phoneNumber}`]);
  });

  const bom = '\uFEFF';
  const csv = bom + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\r\n');
  const filename = `lista_${list.name.replace(/[^a-zA-Z0-9_\-]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
});

/** GET /contacts — legado */
router.get('/', async (req: AuthRequest, res: Response) => {
  const lists = await prisma.contactList.findMany({ where: { userId: req.user!.id } });
  return res.json(lists);
});

export default router;
