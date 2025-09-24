import path from 'path';
import { DatabaseService } from '../databases/mariaDB.js';
import { UtilsException } from '../models/customExceptions.js';
import { sanitizeHtml } from './sanitizer.js';

/**
 * General purpose utility helpers used across the application.
 *
 * - Escaping and sanitization helpers
 * - Simple slug creation and truncation
 * - BigInt conversion helpers for DB rows
 * - Small helpers that avoid pulling large dependencies into routes
 */

const FORBIDDEN_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

// Utility zum sicheren Escapen von Dateinamen
export function sanitizeFilename(name) {
  return path.basename(name)                // Pfadbestandteile entfernen
    .replace(/[^a-zA-Z0-9._-]/g, '_')      // nur erlaubte Zeichen
    .substring(0, 255);                     // Länge begrenzen
}
/**
 * Escapes HTML entities in a string to prevent injection when rendering
 * untrusted content into templates.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
export function unescapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'');
}
/**
 * Escape strings recursively but:
 * - prevent prototype pollution by skipping forbidden keys
 * - allow whitelist fields to be SANITIZED (DOMPurify) instead of raw
 *
 * @param {any} obj
 * @param {string[]} whitelist - field names that should be sanitized (allowed HTML)
 * @param {string[]} path
 */
export function escapeAllStrings(obj, whitelist = [], path = [], domPurifyInstance = null) {
  if(!obj) throw new Error('Invalid input: Object is null or undefined'); // null, undefined, false, 0
  // strings
  if (typeof obj === 'string') {
    const currentKey = path[path.length - 1];
    if (currentKey && whitelist.includes(currentKey)) {
      // SANITIZE allowed HTML server-side (not raw)
      try {
        if (domPurifyInstance && typeof domPurifyInstance.sanitize === 'function') {
          // If a DOMPurify-like instance was supplied, use it (tests inject mocks this way)
          return domPurifyInstance.sanitize(obj, {
            ALLOWED_TAGS: [
              'p','br','b','i','strong','em','u',
              'a','ul','ol','li','img','blockquote','pre','code','h1','h2','h3',
            ],
            ALLOWED_ATTR: ['href','title','target','rel','src','alt'],
            ALLOW_DATA_ATTR: false,
          });
        }
        return sanitizeHtml(obj);
      } catch (error) {
        throw new Error(`Sanitization failed for key "${currentKey}": ${error.message}`);
      }
    }
    return escapeHtml(obj);
  }
  // arrays
  if (Array.isArray(obj)) {
    return obj.map((item, i) => escapeAllStrings(item, whitelist, [...path, String(i)], domPurifyInstance));
  }
  // objects
  if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (FORBIDDEN_KEYS.has(key)) {
        // skip to prevent prototype pollution
        throw new Error(`Forbidden key detected: "${key}"`);
        //continue;
      }
      obj[key] = escapeAllStrings(obj[key], whitelist, [...path, key], domPurifyInstance);
    }
    return obj;
  }
  throw new UtilsException('Unsupported input type');
}
/**
 * Create a URL-friendly slug from a title.
 * Handles German umlauts and diacritics, strips control characters,
 * and collapses whitespace.
 */
export function createSlug(title, { maxLength = 50 /*, addHash = true */ } = {}) {
  if (!title) return '';

  // Kleinbuchstaben
  let slug = title.toLowerCase();
  // Umlaute ersetzen
  const map = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
  slug = slug.replace(/[äöüß]/g, m => map[m]);
  // Akzente entfernen
  slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Sonderzeichen entfernen
  slug = slug.replace(/[^a-z0-9\s-]/g, '');
  // Leerzeichen und Bindestriche vereinfachen
  slug = slug.replace(/\s+/g, '-').replace(/-+/g, '-');
  // Bindestriche entfernen
  slug = slug.replace(/^-+|-+$/g, '');
  slug = truncateSlug(slug, maxLength);

  // 8. Optional Hash anhängen
  //   if (addHash) {
  //     const hash = crypto.createHash("md5").update(title).digest("hex").slice(0, 6);
  //     slug = `${slug}-${hash}`;
  //   }

  return slug;
}
// Convert BigInts in the object to Numbers (recursive)
export function convertBigInts(obj) {
  if (typeof obj === 'bigint'){
    if (obj > Number.MAX_SAFE_INTEGER || obj < Number.MIN_SAFE_INTEGER) {
      return NaN;
    }
    return Number(obj);
  }
  if (typeof obj === 'number') return obj;
  if (typeof obj === 'string') return obj; // Nicht NaN!

  if (Array.isArray(obj)) return obj.map(convertBigInts);
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (typeof obj[key] === 'bigint') {
        if (obj[key] > Number.MAX_SAFE_INTEGER || obj[key] < Number.MIN_SAFE_INTEGER) {
          obj[key] = NaN;
        } else {
          obj[key] = Number(obj[key]);
        }
      } else if (typeof obj[key] === 'object') {
        obj[key] = convertBigInts(obj[key]);
      }
    }
  }
  return obj;
}
export function parseTags(tags) {
  if (typeof tags === 'string' && tags.trim() !== '') {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return tags.split(',').map(tag => tag.trim()).filter(Boolean);
    }
  }
  return [];
}
export function truncateSlug(slug, maxLength = 50) {
  if (slug.length <= maxLength) return slug;
  const truncated = slug.slice(0, maxLength);
  const lastDash = truncated.lastIndexOf('-');
  return lastDash > 0 ? truncated.slice(0, lastDash) : truncated;
}
export function incrementViews(req, postId) {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.get('User-Agent');
  const referer = req.get('Referer');

  DatabaseService.increasePostViews(postId, ipAddress, userAgent, referer).catch(err => {
    console.error('Fehler beim Tracking:', err);
  });
  // Probabilistic cache invalidation: occasionally invalidate mostRead cache
  // to ensure popular lists reflect recent view counts without deleting cache on every hit.
  try {
    const rand = Math.random();
    if (rand < 0.01) { // ~1% chance
      // Lazy-load simpleCache to avoid cyclic deps at module load time
      import('../utils/simpleCache.js').then(m => m.default).then(simpleCache => {
        try {
          console.debug('incrementViews: probabilistic cache invalidation triggered for posts:mostRead');
        } catch (_e) { /* ignore */ }
        if (simpleCache && typeof simpleCache.del === 'function') {
          try { simpleCache.del('posts:mostRead'); } catch (_e) { /* ignore */ }
        }
      }).catch(() => { /* ignore import failures */ });
    }
  } catch (_err) {
    // best-effort invalidation, ignore failures
  }
}
