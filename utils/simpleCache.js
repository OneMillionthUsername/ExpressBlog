/**
 * Simple in-memory cache with TTL and basic LRU protections for single-instance use.
 * Not suitable for multi-process deployments (use Redis or similar there).
 *
 * Exposes `set`, `get`, `del`, `clear` and `getStats` helpers. Values are
 * deep-cloned on retrieval to avoid accidental mutation by callers.
 */

import { sanitizeFields } from './sanitizer.js';

const store = new Map();

function now() {
  return Date.now();
}

const DEFAULT_TTL = Number(process.env.POSTS_CACHE_TTL_MS || 3600000); // 60 minutes default
const MAX_ENTRIES = Number(process.env.POSTS_CACHE_MAX_ENTRIES || 500);
// Max total bytes for cached serialized values (0 = disabled)
const MAX_BYTES = Number(process.env.POSTS_CACHE_MAX_BYTES || 0);

let totalBytes = 0;

function ensureLimit() {
  // Evict oldest entries while we exceed entry count or byte size limits
  while (store.size > MAX_ENTRIES || (MAX_BYTES > 0 && totalBytes > MAX_BYTES)) {
    const firstKey = store.keys().next().value;
    const entry = store.get(firstKey);
    if (!entry) break;
    if (typeof entry.size === 'number') totalBytes -= entry.size;
    store.delete(firstKey);
  }
}

function deepClone(value) {
  // Use structuredClone when available (Node 18+), fallback to JSON methods
  try {
    if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  } catch (_e) { /* ignore */ }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_e) {
    return value;
  }
}

function sanitizeForCache(value) {
  try {
    if (!value) return value;
    // Only attempt to sanitize objects/arrays which may contain content fields
    if (typeof value === 'object') {
      // Work on a clone to avoid mutating caller's object
      // Use the shared sanitizer to sanitize known fields (content, description)
      const cloned = sanitizeFields(value, ['content', 'description']);
      return cloned;
    }
    return value;
  } catch (_err) {
    return value;
  }
}

function sizeOf(value) {
  try {
    const s = JSON.stringify(value);
    return Buffer.byteLength(s, 'utf8');
  } catch (_e) {
    return 0;
  }
}

function set(key, value, ttlMs = DEFAULT_TTL) {
  const expires = ttlMs > 0 ? now() + ttlMs : null;
  const safeValue = sanitizeForCache(value);
  const newSize = sizeOf(safeValue);
  // If replacing existing entry, remove its size contribution
  const existing = store.get(key);
  if (existing && typeof existing.size === 'number') {
    totalBytes -= existing.size;
  }
  store.set(key, { value: safeValue, expires, size: newSize });
  totalBytes += newSize;
  ensureLimit();
}

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expires && entry.expires < now()) {
    // subtract size when evicting expired entry
    if (typeof entry.size === 'number') totalBytes -= entry.size;
    store.delete(key);
    return null;
  }
  // Return a deep clone so callers can't mutate the cached object
  return deepClone(entry.value);
}

function del(key) {
  const entry = store.get(key);
  if (entry && typeof entry.size === 'number') totalBytes -= entry.size;
  store.delete(key);
}

function clear() {
  store.clear();
}

export default {
  set,
  get,
  del,
  clear,
  getStats: () => ({ entries: store.size, totalBytes }),
};
