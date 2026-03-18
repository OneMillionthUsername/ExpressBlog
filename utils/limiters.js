import { BlockList, isIP } from 'node:net';
import rateLimit from 'express-rate-limit';
import logger from './logger.js';

/**
 * Rate limiter helpers used across routes.
 * Exposes `strictLimiter`, `globalLimiter` and `loginLimiter` with
 * sensible defaults and expressive error messages.
 *
 * Set RATE_LIMIT_WHITELIST in .env to a comma-separated list of IPs
 * or CIDR ranges that should bypass all rate limits.
 * Examples: "84.115.0.0/16" or "203.0.113.42,10.0.0.0/8"
 */

const whitelist = new BlockList();
const whitelistEntries = (process.env.RATE_LIMIT_WHITELIST || '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

for (const entry of whitelistEntries) {
  if (entry.includes('/')) {
    const [subnet, prefix] = entry.split('/');
    const type = isIP(subnet) === 6 ? 'ipv6' : 'ipv4';
    whitelist.addSubnet(subnet, Number(prefix), type);
  } else {
    const type = isIP(entry) === 6 ? 'ipv6' : 'ipv4';
    whitelist.addAddress(entry, type);
  }
}

// Normalise IPv4-mapped IPv6 addresses (::ffff:x.x.x.x → x.x.x.x)
// so that rate-limit counters are consistent regardless of format.
function normalizeIp(ip) {
  if (ip && ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

function getClientIp(req) {
  const raw = req.headers['x-forwarded-for']?.split(',')[0].trim()
    || req.headers['x-real-ip']
    || req.ip
    || req.socket.remoteAddress;
  return normalizeIp(raw);
}

function isWhitelisted(req) {
  if (whitelistEntries.length === 0) return false;
  const ip = getClientIp(req);
  return ip ? whitelist.check(ip) : false;
}

// Shared handler that logs every rate-limit block
function makeHandler(limiterName) {
  return (req, res, _next, _options) => {
    const ip = getClientIp(req);
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
  keyGenerator: (req) => getClientIp(req) || 'unknown',
  message: { error: 'Rate limit exceeded' },
};

// Schärfere Limits für kritische Endpoints
const strictLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 15 * 60 * 1000,
  max: 400,
  skip: isWhitelisted,
  handler: makeHandler('strictLimiter'),
});

const globalLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 15 * 60 * 1000,
  max: 1200,
  skip: isWhitelisted,
  handler: makeHandler('globalLimiter'),
});

const loginLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: isWhitelisted,
  handler: (req, res, _next, _options) => {
    const ip = getClientIp(req);
    logger.warn('[SECURITY] Login rate-limit exceeded – possible brute-force attack', {
      ip,
      username: req.body?.username ?? null,
      userAgent: req.get('User-Agent'),
    });
    logger.authEvent('AUTH_LOGIN_RATE_LIMIT', {
      ip,
      username: req.body?.username ?? 'unknown',
      route: req.originalUrl,
      method: req.method,
      userAgent: req.get('User-Agent') || 'unknown',
    }, 'WARN');
    res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
  },
});

export {
  strictLimiter,
  globalLimiter,
  loginLimiter,
};
