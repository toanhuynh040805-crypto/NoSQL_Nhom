import { Router } from 'express';
import { z } from 'zod';
import { Food } from '../models/Food.js';
import { optionalAuth } from '../middleware/auth.js';
import { cartOwner, putCartItem, readCart, removeCartItem, clearCart } from '../services/cart.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(optionalAuth);

router.get('/', asyncHandler(async (req, res) => {
  res.json({ items: await readCart(cartOwner(req)) });
}));

router.put('/items/:foodId', asyncHandler(async (req, res) => {
  const body = z.object({
    quantity: z.coerce.number().int().min(1).max(20),
    note: z.string().trim().max(200).default('')
  }).parse(req.body);
  const food = await Food.findById(req.params.foodId).lean();
  if (!food || !food.isAvailable) throw new AppError(404, 'Món ăn không còn phục vụ');
  const items = await putCartItem(cartOwner(req), {
    foodId: food._id.toString(), name: food.name, price: food.price,
    imageUrl: food.imageUrl, quantity: body.quantity, note: body.note
  });
  res.json({ items });
}));

router.delete('/items/:foodId', asyncHandler(async (req, res) => {
  res.json({ items: await removeCartItem(cartOwner(req), req.params.foodId) });
}));

router.delete('/', asyncHandler(async (req, res) => {
  await clearCart(cartOwner(req));
  res.status(204).end();
}));

export default router;

