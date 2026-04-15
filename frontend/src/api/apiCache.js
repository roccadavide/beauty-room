const CACHE = new Map();
const TTL = 5 * 60 * 1000; // 5 minuti

export function getCached(key) {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL) {
    CACHE.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached(key, data) {
  CACHE.set(key, { data, ts: Date.now() });
}

export function invalidateCache(...keys) {
  keys.forEach(k => CACHE.delete(k));
}
