import _path from 'path';
import { escapeAllStrings } from '../utils/utils.js';
import * as utils from '../utils/utils.js';
import logger from '../utils/logger.js';

// --- Helper: safer content-type check ---
export function requireJsonContent(req, res, next) {
  const contentType = (req.get('content-type') || '').toLowerCase();

  if (!contentType.startsWith('application/json')) {
    return res
      .status(415)
      .json({ error: 'Content-Type muss application/json sein' });
  }
  next(); // alles ok → nächste Middleware / Route
}
/**
 * Factory to create middleware
 * @param {string[]} whitelist - names of fields that contain HTML (e.g. ['content'])
 */
export function createEscapeInputMiddleware(whitelist = []) {
  return function escapeInputMiddleware(req, res, next) {
    try {
      if (req.body && typeof req.body === 'object') {
        Object.assign(req.body, escapeAllStrings(req.body, whitelist));
      }
      if (req.query && typeof req.query === 'object') {
        Object.assign(req.query, escapeAllStrings(req.query, whitelist));
      }
      if (req.params && typeof req.params === 'object') {
        Object.assign(req.params, escapeAllStrings(req.params, whitelist));
      }
      if (req.cookies && typeof req.cookies === 'object') {
        // Exclude CSRF tokens from sanitization to prevent loops
        const csrfKeys = ['_csrf'];
        const cookiesToSanitize = Object.fromEntries(
          Object.entries(req.cookies).filter(([key]) => !csrfKeys.includes(key)),
        );
        const sanitizedCookies = escapeAllStrings(cookiesToSanitize, whitelist);
        Object.assign(req.cookies, sanitizedCookies);
      }
      const safeHeaders = ['user-agent', 'referer'];
      safeHeaders.forEach(h => {
        if (req.headers[h] && typeof req.headers[h] === 'object') {
          Object.assign(req.headers[h], escapeAllStrings(req.headers[h], whitelist));
        } else if (req.headers[h] && typeof req.headers[h] === 'string') {
          req.headers[h] = escapeAllStrings(req.headers[h], whitelist);
        }
      });
      // File-Uploads: nur die Originalnamen escapen
      if (req.file) {
        req.file.safeFilename = utils.sanitizeFilename(req.file.originalname);
      }
      if (req.files) {
        req.files.forEach(f => {
          f.safeFilename = utils.sanitizeFilename(f.originalname);
        });
      }
    } catch (err) {
      // don't crash the server because of bad input
      console.error('Error in escapeInputMiddleware:', err);
      return next();
    }
    next();
  };
}
// --- error handler (production-safe) ---
export function errorHandlerMiddleware(err, req, res, _next) {
  logger.debug('errorHandlerMiddleware: Caught error', {
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    error: err.message,
    stack: err.stack,
  });
  
  logger.error('Error in request processing:', {
    url: req.url,
    method: req.method,
    error: err.message,
    stack: err.stack,
  }); // internal logging only
  
  res.status(500).json({ error: 'Internal Server Error' });
}