import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { redis } from '../config/database.js';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../utils/errors.js';

async function resolveUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const payload = jwt.verify(token, env.jwtSecret);
  if (await redis.get(`token:block:${payload.jti}`)) return null;
  const user = await User.findById(payload.sub);
  return user?.isActive ? { user, tokenPayload: payload } : null;
}

export const optionalAuth = asyncHandler(async (req, res, next) => {
  try {
    const resolved = await resolveUser(req);
    if (resolved) Object.assign(req, resolved);
  } catch {
    // Khách vẫn có thể xem thực đơn khi token cũ/không hợp lệ.
  }
  next();
});

export const requireAuth = asyncHandler(async (req, res, next) => {
  const resolved = await resolveUser(req);
  if (!resolved) throw new AppError(401, 'Vui lòng đăng nhập');
  Object.assign(req, resolved);
  next();
});

export function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : next(new AppError(403, 'Bạn không có quyền thực hiện thao tác này'));
}

