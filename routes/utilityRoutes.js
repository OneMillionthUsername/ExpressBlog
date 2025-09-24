import express from 'express';
import * as config from '../config/config.js';
const utilityRouter = express.Router();

/**
 * Utility endpoints (health, redirect, csrf-token).
 *
 * The CSRF token endpoint is intentionally left without route-level
 * enforcement so the application-level CSRF middleware can centrally
 * decide when to skip protection (see `app.js`). This avoids the
 * chicken-and-egg problem where the token endpoint itself would be
 * protected and therefore unavailable to clients.
 */

utilityRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    version: process.env.npm_package_version || '1.0.0',
  });
});

utilityRouter.get('/redirect', (req, res) => {
  try {
    const url = new URL(req.query.url);
    // Enforce HTTPS and restrict to our domain(s)
    const allowedHosts = new Set([
      config.DOMAIN,
      `www.${config.DOMAIN}`,
    ]);
    if (url.protocol !== 'https:' || !allowedHosts.has(url.host)) {
      return res.status(400).end(`Unsupported redirect target: ${req.query.url}`);
    }
    res.redirect(url.toString());
  } catch (_e) {
    return res.status(400).end(`Invalid url: ${req.query.url}`);
  }
});

// The app-level CSRF middleware controls protection for `/api/csrf-token`.
// Do not apply `csrfProtection` here so clients can fetch a token.
utilityRouter.get('/csrf-token', (req, res) => {
  // Prevent caching of CSRF token responses (defensive headers)
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.json({ csrfToken: req.csrfToken() });
});

export default utilityRouter;