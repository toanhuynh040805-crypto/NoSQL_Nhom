import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { Food } from '../models/Food.js';
import { Order } from '../models/Order.js';
import { Review } from '../models/Review.js';
import { recordReviewGraph } from '../services/graph.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();

router.get('/food/:foodId', asyncHandler(async (req, res) => {
  const reviews = await Review.find({ food: req.params.foodId, isVisible: true })
    .populate('customer', 'fullName').sort({ createdAt: -1 }).limit(50).lean();
  res.json({ reviews });
}));

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    foodId: z.string(), orderId: z.string(),
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().max(500).default('')
  }).parse(req.body);
  const eligible = await Order.exists({
    _id: body.orderId, customer: req.user._id, status: 'completed', 'items.food': body.foodId
  });
  if (!eligible) throw new AppError(403, 'Chỉ được đánh giá món trong đơn đã hoàn thành');
  const review = await Review.findOneAndUpdate(
    { customer: req.user._id, food: body.foodId, order: body.orderId },
    { rating: body.rating, comment: body.comment, isVisible: true },
    { upsert: true, new: true, runValidators: true }
  );
  const stats = await Review.aggregate([
    { $match: { food: review.food, isVisible: true } },
    { $group: { _id: '$food', average: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  await Promise.all([
    Food.updateOne({ _id: body.foodId }, {
      ratingAverage: stats[0]?.average || 0, ratingCount: stats[0]?.count || 0
    }),
    recordReviewGraph(req.user.id, body.foodId, body.rating)
  ]);
  res.status(201).json({ review });
}));

export default router;

