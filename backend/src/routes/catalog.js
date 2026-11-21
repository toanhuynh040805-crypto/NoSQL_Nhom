import { Router } from 'express';
import { z } from 'zod';
import { Category } from '../models/Category.js';
import { Food } from '../models/Food.js';
import { cacheJson } from '../services/cache.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();

router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await cacheJson('menu:categories', 300, () =>
    Category.find().sort({ name: 1 }).lean()
  );
  res.json({ categories });
}));

router.get('/foods', asyncHandler(async (req, res) => {
  const query = z.object({
    search: z.string().trim().max(100).optional(),
    category: z.string().optional(),
    available: z.enum(['true', 'false']).default('true'),
    sort: z.enum(['popular', 'price-asc', 'price-desc', 'rating', 'newest']).default('popular'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12)
  }).parse(req.query);
  const filter = { isAvailable: query.available === 'true' };
  if (query.category) filter.category = query.category;
  if (query.search) filter.$text = { $search: query.search };
  const sortMap = {
    popular: { soldCount: -1, name: 1 },
    'price-asc': { price: 1 },
    'price-desc': { price: -1 },
    rating: { ratingAverage: -1, ratingCount: -1 },
    newest: { createdAt: -1 }
  };
  const [foods, total] = await Promise.all([
    Food.find(filter).populate('category', 'name slug type')
      .sort(sortMap[query.sort]).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    Food.countDocuments(filter)
  ]);
  res.json({ foods, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
}));

router.get('/foods/:id', asyncHandler(async (req, res) => {
  const food = await Food.findById(req.params.id).populate('category', 'name slug type').lean();
  if (!food) throw new AppError(404, 'Không tìm thấy món ăn');
  res.json({ food });
}));

export default router;

