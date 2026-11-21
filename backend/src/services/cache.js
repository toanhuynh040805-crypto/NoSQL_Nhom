import { redis } from '../config/database.js';

export async function cacheJson(key, ttlSeconds, loader) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  const value = await loader();
  await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  return value;
}

export async function clearMenuCache() {
  const keys = await redis.keys('menu:*');
  if (keys.length) await redis.del(keys);
}

