import express from 'express';
import logger from '../utils/logger.js';
import * as authService from '../services/authService.js';
import { TINY_MCE_API_KEY } from '../config/config.js';

const staticRouter = express.Router();

staticRouter.get('/', (req, res) => {
  logger.debug(`[HOME] GET / requested from ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
  logger.debug('[HOME] GET / - Rendering index.ejs');
  
  try {
    res.render('index');
    logger.debug('[HOME] GET / - Successfully rendered index.ejs');
  } catch (error) {
    logger.error('[HOME] GET / - Error rendering index.ejs:', error);
    res.status(500).send('Error rendering homepage');
  }
});

staticRouter.get('/about', (req, res) => {
  res.render('about');
});

staticRouter.get('/createPost', (req, res) => {
  try {
    // Determine if requester is authenticated admin by extracting token
    const token = authService.extractTokenFromRequest(req);
    let isAdmin = false;
    if (token) {
      const decoded = authService.verifyToken(token);
      if (decoded && decoded.role && decoded.role === 'admin') {
        isAdmin = true;
      }
    }

    // Only expose tinyMCE key to authenticated admins when rendering the page
    const tinyMceKey = isAdmin ? TINY_MCE_API_KEY : null;
    res.render('createPost', { tinyMceKey, isAdmin });
  } catch (err) {
    logger.error('[CREATEPOST] Error rendering createPost:', err);
    // Render without key (non-admin)
    res.render('createPost', { tinyMceKey: null, isAdmin: false });
  }
});

staticRouter.get('/about.html', (req, res) => {
  res.redirect('/about');
});

staticRouter.get('/posts', (req, res) => {
  res.render('listCurrentPosts');
});

export default staticRouter;