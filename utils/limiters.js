import rateLimit from 'express-rate-limit';

/**
 * Rate limiter helpers used across routes.
 * Exposes `strictLimiter`, `globalLimiter` and `loginLimiter` with
 * sensible defaults and expressive error messages.
 */
// --- Rate limiters ---
// Basis-Konfiguration für alle Limiter
const baseLimiterConfig = {
  standardHeaders: true,
  legacyHeaders: false, // Moderne Header verwenden
  message: { error: 'Rate limit exceeded' },
};

// Schärfere Limits für kritische Endpoints
const strictLimiter = rateLimit({
  ...baseLimiterConfig,
  // Increase strict limiter to allow more requests during admin/API usage
  windowMs: 15 * 60 * 1000,
  max: 60,
});

const globalLimiter = rateLimit({
  ...baseLimiterConfig,
  // Raise global limits to reduce accidental throttling during normal browsing
  windowMs: 15 * 60 * 1000,
  max: 120,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export {
  strictLimiter,
  globalLimiter,
  loginLimiter,
};
