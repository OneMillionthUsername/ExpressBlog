import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Server-side DOMPurify instance using JSDOM window
const window = new JSDOM('').window;
const DOMPurifyServer = DOMPurify(window);

/**
 * Sanitize a single HTML string using server-side DOMPurify with a safe whitelist.
 * @param {string} html
 * @returns {string}
 */
export function sanitizeHtml(html) {
  if (typeof html !== 'string') return html;
  return DOMPurifyServer.sanitize(html, {
    ALLOWED_TAGS: [
      'p','br','b','i','strong','em','u',
      'a','ul','ol','li','img','blockquote','pre','code','h1','h2','h3',
    ],
    ALLOWED_ATTR: ['href','title','target','rel','src','alt'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Recursively sanitize specified fields in an object/array. Works in-place on a clone.
 * @param {any} input
 * @param {string[]} fields - field names to sanitize (e.g. ['content','description'])
 */
export function sanitizeFields(input, fields = []) {
  if (!input) return input;
  const isObject = typeof input === 'object' && input !== null;
  if (!isObject) return input;

  const cloned = (typeof globalThis.structuredClone === 'function') ? globalThis.structuredClone(input) : JSON.parse(JSON.stringify(input));

  const scrub = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      try {
        if (fields.includes(k) && typeof obj[k] === 'string') {
          obj[k] = sanitizeHtml(obj[k]);
        } else if (typeof obj[k] === 'object') {
          scrub(obj[k]);
        }
      } catch (_e) { /* ignore per-field errors */ }
    }
  };

  scrub(cloned);
  return cloned;
}

export default { sanitizeHtml, sanitizeFields };
