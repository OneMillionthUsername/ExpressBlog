import rateLimit from 'express-rate-limit';

// --- Rate limiters ---
// Basis-Konfiguration für alle Limiter
const baseLimiterConfig = {
  standardHeaders: true,
  legacyHeaders: false, // Moderne Header verwenden
  message: { error: 'Rate limit exceeded' }
};

// Schärfere Limits für kritische Endpoints
const strictLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 15 * 60 * 1000,
  max: 10
});

const globalLimiter = rateLimit({
  ...baseLimiterConfig,
  windowMs: 15 * 60 * 1000,
  max: 30
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: { error: 'Too many login attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

export {
  strictLimiter,
  globalLimiter,
  loginLimiter
};
