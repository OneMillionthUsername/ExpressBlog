import express from 'express';
import * as config from '../config/config.js';
import logger from '../middleware/loggerMiddleware.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
const utilityRouter = express.Router();

/**
 * Utility endpoints (health, redirect, csrf-token, google-api-key).
 *
 * The CSRF token endpoint is intentionally left without route-level
 * enforcement so the application-level CSRF middleware can centrally
 * decide when to skip protection (see `app.js`). This avoids the
 * chicken-and-egg problem where the token endpoint itself would be
 * protected and therefore unavailable to clients.
 *
 * The google-api-key endpoint requires authentication and exposes the
 * server-side Gemini API key only to authenticated admins.
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

// CSRF token endpoint - creates a new token for clients to use
utilityRouter.get('/csrf-token', (req, res) => {
  try {
    // Prevent caching of CSRF token responses (defensive headers)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    // Check if csrfToken function is available
    if (typeof req.csrfToken === 'function') {
      res.json({ csrfToken: req.csrfToken() });
    } else {
      // Fallback - this shouldn't happen but provides graceful degradation
      logger.warn('req.csrfToken function not available in csrf-token endpoint');
      res.status(500).json({ error: 'CSRF token generation unavailable' });
    }
  } catch (error) {
    logger.error('Error generating CSRF token', { error: error.message });
    res.status(500).json({ error: 'Failed to generate CSRF token' });
  }
});

// Gemini API key endpoint - expose key via server-side only (secure)
// Only admins can access this; the client requests it to configure AI assistant
utilityRouter.get('/google-api-key', authenticateToken, (req, res) => {
  try {
    // Check if user is admin
    const isAdmin = req.user && req.user.isAdmin;
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // Return the API key if available
    const apiKey = config.GEMINI_API_KEY || '';
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return res.json({ 
        success: false, 
        data: { apiKey: '' },
        error: 'Gemini API key not configured' 
      });
    }

    res.json({ 
      success: true, 
      data: { apiKey } 
    });
  } catch (error) {
    logger.error('Error fetching Gemini API key', { error: error.message });
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default utilityRouter;