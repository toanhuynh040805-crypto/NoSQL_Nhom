import { Router } from 'express';
import { z } from 'zod';
import { redis } from '../config/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Food } from '../models/Food.js';
import { Order } from '../models/Order.js';
import { cartOwner, clearCart, readCart } from '../services/cart.js';
import { recordOrderGraph } from '../services/graph.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    orderType: z.enum(['dine-in', 'takeaway']).default('dine-in'),
    tableNumber: z.string().trim().max(20).optional(),
    note: z.string().trim().max(300).default('')
  }).parse(req.body);
  if (body.orderType === 'dine-in' && !body.tableNumber) throw new AppError(400, 'Vui lòng nhập số bàn');
  const owner = cartOwner(req);
  const cart = await readCart(owner);
  if (!cart.length) throw new AppError(400, 'Giỏ hàng đang trống');

  const foods = await Food.find({ _id: { $in: cart.map(item => item.foodId) }, isAvailable: true });
  const foodMap = new Map(foods.map(food => [food.id, food]));
  const items = cart.map(cartItem => {
    const food = foodMap.get(cartItem.foodId);
    if (!food) throw new AppError(409, `Món ${cartItem.name} không còn phục vụ`);
    return { food: food._id, name: food.name, price: food.price, quantity: cartItem.quantity, note: cartItem.note };
  });
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderCode = `OD${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const order = await Order.create({
    orderCode, customer: req.user._id, items, subtotal,
    orderType: body.orderType, tableNumber: body.tableNumber, note: body.note,
    statusHistory: [{ status: 'pending' }]
  });
  await Promise.all([
    ...items.map(item => Food.updateOne({ _id: item.food }, { $inc: { soldCount: item.quantity } })),
    ...items.map(item => redis.zIncrBy('leaderboard:foods', item.quantity, String(item.food))),
    clearCart(owner),
    recordOrderGraph(req.user, order)
  ]);
  res.status(201).json({ order });
}));

router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  const orders = await Order.find({ customer: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ orders });
}));

router.patch('/:id/status', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const { status } = z.object({
    status: z.enum(['confirmed', 'preparing', 'ready', 'completed', 'cancelled'])
  }).parse(req.body);
  const order = await Order.findByIdAndUpdate(req.params.id, {
    status, $push: { statusHistory: { status, changedAt: new Date() } }
  }, { new: true });
  if (!order) throw new AppError(404, 'Không tìm thấy đơn hàng');
  res.json({ order });
}));

export default router;

