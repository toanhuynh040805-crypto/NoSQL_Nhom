import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Food } from '../models/Food.js';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({ path: 'favoriteFoods', populate: { path: 'category', select: 'name slug' } });
  res.json({ foods: user.favoriteFoods });
}));

router.post('/:foodId', asyncHandler(async (req, res) => {
  if (!(await Food.exists({ _id: req.params.foodId, isAvailable: true }))) throw new AppError(404, 'Không tìm thấy món ăn');
  await User.updateOne({ _id: req.user._id }, { $addToSet: { favoriteFoods: req.params.foodId } });
  res.status(201).json({ message: 'Đã thêm vào yêu thích' });
}));

router.delete('/:foodId', asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { favoriteFoods: req.params.foodId } });
  res.status(204).end();
}));

export default router;

