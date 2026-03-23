"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.use(auth_middleware_1.authenticate);
router.post('/lists', async (req, res) => {
    const list = await database_1.default.contactList.create({ data: { userId: req.user.id, name: req.body.name, description: req.body.description } });
    return res.status(201).json(list);
});
router.get('/lists', async (req, res) => {
    const lists = await database_1.default.contactList.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
    return res.json(lists);
});
router.get('/lists/:id/contacts', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const contacts = await database_1.default.contact.findMany({
        where: { contactListId: parseInt(req.params.id) },
        skip: (page - 1) * limit, take: limit,
    });
    const total = await database_1.default.contact.count({ where: { contactListId: parseInt(req.params.id) } });
    return res.json({ contacts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});
router.post('/import-csv', upload.single('file'), async (req, res) => {
    return res.json({ message: 'Import via CSV disponível', imported: 0 });
});
router.get('/', async (req, res) => {
    const lists = await database_1.default.contactList.findMany({ where: { userId: req.user.id } });
    return res.json(lists);
});
exports.default = router;
//# sourceMappingURL=list.routes.js.map