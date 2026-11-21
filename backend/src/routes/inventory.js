import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'staff'));

router.get('/', asyncHandler(async (req, res) => {
  const items = await InventoryItem.find({ isActive: true }).sort({ name: 1 }).lean();
  res.json({ items: items.map(item => ({ ...item, isLowStock: item.currentStock <= item.minimumStock })) });
}));

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(100), unit: z.string().trim().min(1).max(30),
    currentStock: z.coerce.number().min(0).default(0), minimumStock: z.coerce.number().min(0).default(0),
    supplier: z.string().trim().max(150).default('')
  }).parse(req.body);
  const item = await InventoryItem.create(body);
  res.status(201).json({ item });
}));

router.patch('/:id/adjust', asyncHandler(async (req, res) => {
  const body = z.object({
    type: z.enum(['import', 'usage', 'adjustment']),
    quantity: z.coerce.number().refine(value => value !== 0, 'Số lượng phải khác 0'),
    note: z.string().trim().max(300).default('')
  }).parse(req.body);
  const item = await InventoryItem.findById(req.params.id);
  if (!item) throw new AppError(404, 'Không tìm thấy nguyên liệu');
  const delta = body.type === 'usage' ? -Math.abs(body.quantity) : body.quantity;
  if (item.currentStock + delta < 0) throw new AppError(409, 'Số lượng xuất vượt quá tồn kho');
  item.currentStock += delta;
  item.movements.push({ ...body, quantity: delta, performedBy: req.user._id });
  if (item.movements.length > 100) item.movements = item.movements.slice(-100);
  await item.save();
  res.json({ item, isLowStock: item.currentStock <= item.minimumStock });
}));

router.put('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(100).optional(), unit: z.string().trim().min(1).max(30).optional(),
    minimumStock: z.coerce.number().min(0).optional(), supplier: z.string().trim().max(150).optional(),
    isActive: z.boolean().optional()
  }).parse(req.body);
  const item = await InventoryItem.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!item) throw new AppError(404, 'Không tìm thấy nguyên liệu');
  res.json({ item });
}));

export default router;

