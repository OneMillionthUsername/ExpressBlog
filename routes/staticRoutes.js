import express from 'express';
import logger from '../utils/logger.js';
import { decodeHtmlEntities } from '../public/assets/js/shared/text.js';
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
        const decodedPlain = decodeHtmlEntities(plain);
        const excerpt = decodedPlain.length > 150 ? decodedPlain.substring(0, 150) + '...' : decodedPlain;
        const decodedTitle = decodeHtmlEntities(p.title || '');
        return { title: decodedTitle, slug: p.slug, excerpt };
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

staticRouter.get('/createPost', async (req, res) => {
  try {
    // Determine if requester is authenticated admin by extracting token
    const token = authService.extractTokenFromRequest(req);
    let isAdmin = false;
    try {
      const hasAuthHeader = !!(req.headers && typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer '));
      const hasAuthCookie = !!(req.cookies && typeof req.cookies[authService.AUTH_COOKIE_NAME] === 'string');
      // Do not log token values; only presence
      logger.debug('[CREATEPOST] SSR auth context', {
        hasAuthHeader,
        hasAuthCookie,
        cookieNames: Object.keys(req.cookies || {}),
        ip: req.ip,
        userAgent: req.get('User-Agent') || null,
      });
    } catch { /* ignore logging errors */ }
    if (token) {
      const decoded = authService.verifyToken(token);
      if (decoded && decoded.role && decoded.role === 'admin') {
        isAdmin = true;
      }
    }

    // Only expose tinyMCE key to authenticated admins when rendering the page
    const tinyMceKey = isAdmin ? TINY_MCE_API_KEY : null;
    logger.debug('[CREATEPOST] SSR computed flags', {
      isAdmin,
      tinyMceKeyProvided: !!tinyMceKey,
    });

    // If a `post` query parameter is provided (edit flow), try to fetch the post
    // server-side and inject it into the view so the editor can be prefilled
    // without an extra client request. Support numeric id or slug.
    const postParam = req.query.post;
    let serverPost = null;
    if (postParam) {
      try {
        if (/^[0-9]+$/.test(postParam)) {
          serverPost = await postController.getPostById(postParam);
        } else {
          serverPost = await postController.getPostBySlug(postParam);
        }
        // Convert bigints if controller returns them (controller functions
        // usually return raw DB objects; controller's callers normally handle converting)
        // But keep it simple and pass through the object as-is; views will treat fields as strings
      } catch (fetchErr) {
        logger.debug('[CREATEPOST] Could not fetch post for prefill:', fetchErr && fetchErr.message);
        serverPost = null;
      }
    }

    // IMPORTANT: Do NOT expose the GEMINI API key to the browser.
    res.render('createPost', { tinyMceKey, isAdmin, post: serverPost });
  } catch (err) {
    logger.error('[CREATEPOST] Error rendering createPost:', err);
    // Render without key (non-admin)
    res.render('createPost', { tinyMceKey: null, isAdmin: false, post: null });
  }
});

staticRouter.get('/about.html', (req, res) => {
  res.redirect('/about');
});

staticRouter.get('/posts', async (req, res) => {
  try {
    // Server-side render the list of current posts to preserve the
    // HTML-first experience and avoid client-side JSON-only rendering.
    const posts = await postController.getAllPosts();
    // Pass posts (controller returns JS objects); views will handle formatting
    return res.render('listCurrentPosts', { posts });
  } catch (err) {
    logger.error('[POSTS] Error rendering listCurrentPosts:', err && err.message);
    // Fallback: render without posts so client-side JS can still attempt to fetch
    return res.render('listCurrentPosts');
  }
});

export default staticRouter;