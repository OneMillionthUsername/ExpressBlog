import DOMPurify from 'dompurify'; // npm install dompurify
import { JSDOM } from 'jsdom';

// Für Node.js Server-Side
const window = new JSDOM('').window;
const DOMPurifyServer = DOMPurify(window);

const FORBIDDEN_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype'
]);


// Utility zum sicheren Escapen von Dateinamen
export function sanitizeFilename(name) {
  return path.basename(name)                // Pfadbestandteile entfernen
    .replace(/[^a-zA-Z0-9._-]/g, "_")      // nur erlaubte Zeichen
    .substring(0, 255);                     // Länge begrenzen
}

function escapeHtml(str) {
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
    .replace(/&#39;/g, "'");
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
export function escapeAllStrings(obj, whitelist = [], path = []) {
  path = path || [];
  // strings
  if (typeof obj === 'string') {
    const currentKey = path[path.length - 1];
    if (currentKey && whitelist.includes(currentKey)) {
      // SANITIZE allowed HTML server-side (not raw)
      return DOMPurifyServer.sanitize(obj, {
        ALLOWED_TAGS: [
          'p','br','b','i','strong','em','u',
          'a','ul','ol','li','img','blockquote','pre','code','h1','h2','h3'
        ],
        ALLOWED_ATTR: ['href','title','target','rel','src','alt'],
        ALLOW_DATA_ATTR: false
      });
    }
    return escapeHtml(obj);
  }

  // arrays
  if (Array.isArray(obj)) {
    return obj.map((item, i) => escapeAllStrings(item, whitelist, [...path, String(i)]));
  }

  // objects
  if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (FORBIDDEN_KEYS.has(key)) {
        // skip to prevent prototype pollution
        continue;
      }
      obj[key] = escapeAllStrings(obj[key], whitelist, [...path, key]);
    }
    return obj;
  }
  return obj;
}

export function createSlug(title, { maxLength = 50, addHash = true } = {}) {
  if (!title) return "";

  // Kleinbuchstaben
  let slug = title.toLowerCase();
  // Umlaute ersetzen
  const map = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };
  slug = slug.replace(/[äöüß]/g, m => map[m]);
  // Akzente entfernen
  slug = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Sonderzeichen entfernen
  slug = slug.replace(/[^a-z0-9\s-]/g, "");
  // Leerzeichen und Bindestriche vereinfachen
  slug = slug.replace(/\s+/g, "-").replace(/-+/g, "-");
  // Bindestriche entfernen
  slug = slug.replace(/^-+|-+$/g, "");
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
  if (Array.isArray(obj)) return obj.map(convertBigInts);
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (typeof obj[key] === 'bigint') obj[key] = Number(obj[key]);
      else if (typeof obj[key] === 'object') obj[key] = convertBigInts(obj[key]);
    }
  }
  return obj;
}

export function parseTags(tags) {
  if (typeof tags === 'string' && tags.trim() !== '') {
    try {
      return JSON.parse(tags);
    } catch {
      return [];
    }
  }
  return [];
}

// Utility: truncate
function truncateSlug(slug, maxLength = 50) {
  if (slug.length <= maxLength) return slug;
  const truncated = slug.slice(0, maxLength);
  const lastDash = truncated.lastIndexOf("-");
  return lastDash > 0 ? truncated.slice(0, lastDash) : truncated;
}