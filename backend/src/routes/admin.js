import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Category } from '../models/Category.js';
import { Food } from '../models/Food.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { clearMenuCache } from '../services/cache.js';
import { slugify } from '../utils/slug.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const foodSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default(''),
  price: z.coerce.number().min(0),
  unit: z.string().trim().max(30).default('Phần'),
  imageUrl: z.string().trim().max(300).default(''),
  category: z.string(),
  tags: z.array(z.string().trim()).default([]),
  isAvailable: z.boolean().default(true)
});

router.get('/dashboard', asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [users, foods, pendingOrders, today] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    Food.countDocuments(),
    Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] } }),
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfDay }, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, revenue: { $sum: '$subtotal' }, orders: { $sum: 1 } } }
    ])
  ]);
  res.json({ users, foods, pendingOrders, today: today[0] || { revenue: 0, orders: 0 } });
}));

router.get('/orders', asyncHandler(async (req, res) => {
  const orders = await Order.find().populate('customer', 'fullName email phone').sort({ createdAt: -1 }).limit(100).lean();
  res.json({ orders });
}));

router.post('/categories', asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(80),
    type: z.enum(['food', 'drink']).default('food'),
    description: z.string().trim().max(300).default('')
  }).parse(req.body);
  const category = await Category.create({ ...body, slug: slugify(body.name) });
  await clearMenuCache();
  res.status(201).json({ category });
}));

router.post('/foods', asyncHandler(async (req, res) => {
  const body = foodSchema.parse(req.body);
  if (!(await Category.exists({ _id: body.category }))) throw new AppError(400, 'Danh mục không hợp lệ');
  const food = await Food.create({ ...body, slug: `${slugify(body.name)}-${Date.now().toString(36)}` });
  await clearMenuCache();
  res.status(201).json({ food });
}));

router.put('/foods/:id', asyncHandler(async (req, res) => {
  const body = foodSchema.partial().parse(req.body);
  if (body.name) body.slug = `${slugify(body.name)}-${req.params.id.slice(-5)}`;
  const food = await Food.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!food) throw new AppError(404, 'Không tìm thấy món ăn');
  await clearMenuCache();
  res.json({ food });
}));

router.delete('/foods/:id', asyncHandler(async (req, res) => {
  const food = await Food.findByIdAndUpdate(req.params.id, { isAvailable: false }, { new: true });
  if (!food) throw new AppError(404, 'Không tìm thấy món ăn');
  await clearMenuCache();
  res.json({ food, message: 'Đã ngừng phục vụ món ăn' });
}));

export default router;

