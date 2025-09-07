import express from 'express';
import csrfProtection from '../utils/csrf.js'; // Falls nötig
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
    if (url.host !== 'speculumx.at') {
      return res.status(400).end(`Unsupported redirect to host: ${req.query.url}`);
    }
    res.redirect(req.query.url);
  } catch (_e) {
    return res.status(400).end(`Invalid url: ${req.query.url}`);
  }
});

utilityRouter.get('/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

export default utilityRouter;