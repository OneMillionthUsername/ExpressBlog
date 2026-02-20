import rateLimit from 'express-rate-limit';
import logger from './logger.js';

/**
 * Rate limiter helpers used across routes.
 * Exposes `strictLimiter`, `globalLimiter` and `loginLimiter` with
 * sensible defaults and expressive error messages.
 */

// Shared handler that logs every rate-limit block
function makeHandler(limiterName) {
  return (req, res, _next, _options) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.headers['x-real-ip'] || req.ip || req.socket.remoteAddress;
    logger.warn(`[RATE-LIMIT] ${limiterName} exceeded`, {
      ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
    });
    res.status(429).json({ error: 'Rate limit exceeded' });
  };
}

// --- Rate limiters ---
// Basis-Konfiguration für alle Limiter
const baseLimiterConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded' },
};

// Schärfere Limits für kritische Endpoints
const strictLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 15 * 60 * 1000,
  max: 400,
  handler: makeHandler('strictLimiter'),
});

const globalLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 15 * 60 * 1000,
  max: 1200,
  handler: makeHandler('globalLimiter'),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, _options) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.headers['x-real-ip'] || req.ip || req.socket.remoteAddress;
    logger.warn('[SECURITY] Login rate-limit exceeded – possible brute-force attack', {
      ip,
      username: req.body?.username ?? null,
      userAgent: req.get('User-Agent'),
    });
    res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
  },
});

export {
  strictLimiter,
  globalLimiter,
  loginLimiter,
};
