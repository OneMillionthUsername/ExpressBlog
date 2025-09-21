import express from 'express';
import logger from '../utils/logger.js';
import * as authService from '../services/authService.js';
import postController from '../controllers/postController.js';
import { TINY_MCE_API_KEY } from '../config/config.js';

const staticRouter = express.Router();

staticRouter.get('/', (req, res) => {
  logger.debug(`[HOME] GET / requested from ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
  logger.debug('[HOME] GET / - Rendering index.ejs');
  
  try {
    // Fetch featured posts (first 3) to avoid hardcoding slugs in the template
    postController.getAllPosts().then(posts => {
      // Strip HTML tags from content server-side when building excerpts to avoid
      // rendering raw HTML in templates. Use a simple regex here; content is
      // trusted from DB but may contain editor HTML.
      const stripTags = (s = '') => String(s).replace(/<[^>]*>/g, '');
      const featuredPosts = (posts || []).slice(0, 3).map(p => {
        const plain = stripTags(p.content || '');
        const excerpt = plain.length > 150 ? plain.substring(0, 150) + '...' : plain;
        return { title: p.title, slug: p.slug, excerpt };
      });
      logger.debug('[HOME] GET / - Rendering index.ejs with featured posts:', { featured_slugs: featuredPosts.map(p => p.slug) });
      res.render('index', { featuredPosts });
      logger.debug('[HOME] GET / - Successfully rendered index.ejs');
    }).catch(err => {
      logger.error('[HOME] GET / - Error fetching featured posts, rendering without dynamic posts:', err);
      res.render('index', { featuredPosts: [] });
    });
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
    // IMPORTANT: Do NOT expose the GEMINI API key to the browser. The AI endpoint
    // should be accessed via a server-side proxy that uses the key from config.
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