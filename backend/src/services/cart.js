import { redis } from '../config/database.js';
import { AppError } from '../utils/errors.js';

const CART_TTL = 60 * 60 * 24;

export function cartOwner(req) {
  if (req.user) return `user:${req.user.id}`;
  const cartId = req.header('x-cart-id');
  if (!cartId || !/^[a-zA-Z0-9_-]{8,80}$/.test(cartId)) {
    throw new AppError(400, 'Thiếu mã giỏ hàng hợp lệ trong x-cart-id');
  }
  return `guest:${cartId}`;
}

const cartKey = owner => `cart:${owner}`;

export async function readCart(owner) {
  const raw = await redis.hGetAll(cartKey(owner));
  return Object.values(raw).map(JSON.parse);
}

export async function putCartItem(owner, item) {
  const key = cartKey(owner);
  await redis.hSet(key, item.foodId, JSON.stringify(item));
  await redis.expire(key, CART_TTL);
  return readCart(owner);
}

export async function removeCartItem(owner, foodId) {
  await redis.hDel(cartKey(owner), foodId);
  return readCart(owner);
}

export async function clearCart(owner) {
  await redis.del(cartKey(owner));
}

