import express from 'express';
import csrfProtection from '../utils/csrf.js';
import * as config from '../config/config.js';
const utilityRouter = express.Router();

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

// Apply CSRF middleware only to this endpoint to generate a token without
// enforcing CSRF on the token fetch itself at the global level.
utilityRouter.get('/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

export default utilityRouter;