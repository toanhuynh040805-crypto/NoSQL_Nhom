import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { Food } from '../models/Food.js';
import { redis } from '../config/database.js';
import { recommendFoodIds } from '../services/graph.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  let ids = [];
  let strategy = 'popular';
  if (req.user) {
    ids = await recommendFoodIds(req.user.id, 8);
    if (ids.length) strategy = 'collaborative-graph';
  }
  if (!ids.length) ids = await redis.zRange('leaderboard:foods', 0, 7, { REV: true });
  let foods = ids.length ? await Food.find({ _id: { $in: ids }, isAvailable: true }).populate('category', 'name').lean() : [];
  foods.sort((a, b) => ids.indexOf(String(a._id)) - ids.indexOf(String(b._id)));
  if (foods.length < 8) {
    const more = await Food.find({ _id: { $nin: foods.map(food => food._id) }, isAvailable: true })
      .sort({ soldCount: -1, ratingAverage: -1 }).limit(8 - foods.length).populate('category', 'name').lean();
    foods.push(...more);
  }
  res.json({ strategy, foods });
}));

export default router;

