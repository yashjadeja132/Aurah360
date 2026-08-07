import redisClient from '../config/redis.js';
import logger from '../libs/logger.js';

const PREFIX = 'aurah360:analytics:';

export async function getCached(key) {
  try {
    const client = redisClient.getClient();
    if (!client || client.status !== 'ready') return null;
    const raw = await client.get(`${PREFIX}${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn('Dashboard cache get failed', { message: err.message });
    return null;
  }
}

export async function setCached(key, value, ttlSeconds = 300) {
  try {
    const client = redisClient.getClient();
    if (!client || client.status !== 'ready') return false;
    await client.setex(`${PREFIX}${key}`, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (err) {
    logger.warn('Dashboard cache set failed', { message: err.message });
    return false;
  }
}

export async function invalidateCached(pattern = '*') {
  try {
    const client = redisClient.getClient();
    if (!client || client.status !== 'ready') return 0;
    const keys = await client.keys(`${PREFIX}${pattern}`);
    if (!keys.length) return 0;
    return client.del(...keys);
  } catch (err) {
    logger.warn('Dashboard cache invalidate failed', { message: err.message });
    return 0;
  }
}

export function cacheKeyFromFilters(prefix, filters = {}) {
  return `${prefix}:${JSON.stringify({
    b: filters.branchId?.toString?.() || filters.branchId || null,
    d: filters.doctorId?.toString?.() || filters.doctorId || null,
    from: filters.dateFrom?.toISOString?.() || filters.dateFrom || null,
    to: filters.dateTo?.toISOString?.() || filters.dateTo || null,
  })}`;
}

export default { getCached, setCached, invalidateCached, cacheKeyFromFilters };
