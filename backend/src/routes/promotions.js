import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Promotion } from '../models/Promotion.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();

router.get('/active', asyncHandler(async (req, res) => {
  const now = new Date();
  const promotions = await Promotion.find({ isActive: true, startAt: { $lte: now }, endAt: { $gte: now } }).sort({ discountValue: -1 }).lean();
  res.json({ promotions });
}));

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(3).max(30).transform(value => value.toUpperCase()),
  description: z.string().trim().max(500).default(''),
  discountType: z.enum(['percent', 'fixed']),
  discountValue: z.coerce.number().min(0),
  minOrderValue: z.coerce.number().min(0).default(0),
  maxDiscount: z.coerce.number().min(0).optional(),
  startAt: z.coerce.date(), endAt: z.coerce.date(),
  usageLimit: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().default(true)
});

function parsePromotionPatch(input) {
  const parsed = schema.partial().parse(input);
  return Object.fromEntries(Object.keys(input).filter(key => parsed[key] !== undefined).map(key => [key, parsed[key]]));
}

router.get('/', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  res.json({ promotions: await Promotion.find().sort({ createdAt: -1 }).lean() });
}));

router.post('/', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const body = schema.parse(req.body);
  if (body.endAt <= body.startAt) throw new AppError(400, 'Thời gian kết thúc phải sau thời gian bắt đầu');
  const promotion = await Promotion.create(body);
  res.status(201).json({ promotion });
}));

router.put('/:id', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const promotion = await Promotion.findByIdAndUpdate(req.params.id, parsePromotionPatch(req.body), { new: true, runValidators: true });
  if (!promotion) throw new AppError(404, 'Không tìm thấy khuyến mãi');
  res.json({ promotion });
}));

router.delete('/:id', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const promotion = await Promotion.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!promotion) throw new AppError(404, 'Không tìm thấy khuyến mãi');
  res.json({ promotion });
}));

export default router;

