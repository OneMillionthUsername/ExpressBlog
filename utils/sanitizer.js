import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Server-side DOMPurify instance using JSDOM window
const window = new JSDOM('').window;
const DOMPurifyServer = DOMPurify(window);

/**
 * HTML sanitization helpers using server-side DOMPurify.
 *
 * - `sanitizeHtml` sanitizes a single HTML string with a conservative
 *   whitelist.
 * - `sanitizeFields` recursively sanitizes specific fields inside objects
 *   (useful before caching or saving to DB).
 */

/**
 * Sanitize a single HTML string using server-side DOMPurify with a safe whitelist.
 * @param {string} html
 * @returns {string}
 */
export function sanitizeHtml(html) {
  if (typeof html !== 'string') return html;
  return DOMPurifyServer.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'option', 'meta', 'link'],
    ADD_ATTR: ['style', 'class', 'id', 'align'],
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
