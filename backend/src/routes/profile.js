import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => res.json({
  user: {
    id: req.user.id, fullName: req.user.fullName, email: req.user.email,
    phone: req.user.phone, role: req.user.role, loyaltyPoints: req.user.loyaltyPoints
  }
}));

router.put('/', asyncHandler(async (req, res) => {
  const body = z.object({
    fullName: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(8).max(20)
  }).parse(req.body);
  const user = await User.findByIdAndUpdate(req.user._id, body, { new: true, runValidators: true });
  res.json({ user: { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, role: user.role, loyaltyPoints: user.loyaltyPoints } });
}));

router.put('/password', asyncHandler(async (req, res) => {
  const body = z.object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(6).max(100)
  }).parse(req.body);
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) throw new AppError(400, 'Mật khẩu hiện tại không đúng');
  user.passwordHash = await bcrypt.hash(body.newPassword, 11);
  await user.save();
  res.json({ message: 'Đổi mật khẩu thành công' });
}));

export default router;

