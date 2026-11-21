import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { redis } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
const credentialsSchema = z.object({
  email: z.email().transform(value => value.toLowerCase()),
  password: z.string().min(6)
});

function publicUser(user) {
  return {
    id: user.id, fullName: user.fullName, email: user.email, phone: user.phone,
    role: user.role, loyaltyPoints: user.loyaltyPoints || 0
  };
}

function createToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, jti: randomUUID() }, env.jwtSecret, { expiresIn: '7d' });
}

async function mergeGuestCart(req, userId) {
  const cartId = req.header('x-cart-id');
  if (!cartId || !/^[a-zA-Z0-9_-]{8,80}$/.test(cartId)) return;
  const guestKey = `cart:guest:${cartId}`;
  const userKey = `cart:user:${userId}`;
  const [guestItems, userItems] = await Promise.all([redis.hGetAll(guestKey), redis.hGetAll(userKey)]);
  for (const [foodId, raw] of Object.entries(guestItems)) {
    const guestItem = JSON.parse(raw);
    const current = userItems[foodId] ? JSON.parse(userItems[foodId]) : null;
    const merged = { ...guestItem, quantity: Math.min(20, guestItem.quantity + (current?.quantity || 0)) };
    await redis.hSet(userKey, foodId, JSON.stringify(merged));
  }
  if (Object.keys(guestItems).length) {
    await Promise.all([redis.expire(userKey, 60 * 60 * 24), redis.del(guestKey)]);
  }
}

router.post('/register', asyncHandler(async (req, res) => {
  const body = credentialsSchema.extend({
    fullName: z.string().trim().min(2).max(80),
    phone: z.string().trim().max(20).optional()
  }).parse(req.body);
  if (await User.exists({ email: body.email })) throw new AppError(409, 'Email đã được sử dụng');
  const user = await User.create({
    fullName: body.fullName,
    email: body.email,
    phone: body.phone,
    passwordHash: await bcrypt.hash(body.password, 11)
  });
  await mergeGuestCart(req, user.id);
  res.status(201).json({ token: createToken(user), user: publicUser(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const body = credentialsSchema.parse(req.body);
  const user = await User.findOne({ email: body.email }).select('+passwordHash');
  if (!user || !user.isActive || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw new AppError(401, 'Email hoặc mật khẩu không đúng');
  }
  await mergeGuestCart(req, user.id);
  res.json({ token: createToken(user), user: publicUser(user) });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  const expiresIn = Math.max(1, req.tokenPayload.exp - Math.floor(Date.now() / 1000));
  await redis.set(`token:block:${req.tokenPayload.jti}`, '1', { EX: expiresIn });
  res.status(204).end();
}));

export default router;

