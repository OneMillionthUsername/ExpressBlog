import express from 'express';
import logger from '../utils/logger.js';
import { decodeHtmlEntities } from '../public/assets/js/shared/text.js';
import postController from '../controllers/postController.js';
import { TINY_MCE_API_KEY } from '../config/config.js';
import { applySsrNoCache, getSsrAdmin } from '../utils/utils.js';

/**
 * Routes serving site pages and server-side rendered views.
 *
 * These endpoints primarily render EJS templates (home, about, posts,
 * createPost editor) and perform minimal server-side composition like
 * fetching featured posts for the homepage.
 */
const staticRouter = express.Router();

staticRouter.get('/', (req, res) => {
  logger.debug(`[HOME] GET / requested from ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
  logger.debug('[HOME] GET / - Rendering index.ejs');
  const isAdmin = getSsrAdmin(res);
  
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
      applySsrNoCache(res, { varyCookie: true });
      res.render('index', { featuredPosts, isAdmin });
      logger.debug('[HOME] GET / - Successfully rendered index.ejs');
    }).catch(err => {
      logger.error('[HOME] GET / - Error fetching featured posts, rendering without dynamic posts:', err);
      applySsrNoCache(res, { varyCookie: true });
      res.render('index', { featuredPosts: [], isAdmin });
    });
  } catch (error) {
    logger.error('[HOME] GET / - Error rendering index.ejs:', error);
    applySsrNoCache(res, { varyCookie: true });
    res.status(500).send('Error rendering homepage');
  }
});

staticRouter.get('/about', (req, res) => {
  const isAdmin = getSsrAdmin(res);
  applySsrNoCache(res, { varyCookie: true });
  res.render('about', { isAdmin });
});

// Use a shared handler for both '/createPost' and '/createPost/:postId' to avoid
// using an optional parameter token ("?") which some path parsers reject.
async function handleCreatePost(req, res) {
  try {
    const isAdmin = getSsrAdmin(res);
    try {
      logger.debug('[CREATEPOST] SSR auth context', {
        isAdmin,
        cookieNames: Object.keys(req.cookies || {}),
        ip: req.ip,
        userAgent: req.get('User-Agent') || null,
      });
    } catch { /* ignore logging errors */ }

    // Only expose tinyMCE key to authenticated admins when rendering the page
    const tinyMceKey = isAdmin ? TINY_MCE_API_KEY : null;
    logger.debug('[CREATEPOST] SSR computed flags', {
      isAdmin,
      tinyMceKeyProvided: !!tinyMceKey,
    });

    // If a `postId` route parameter is provided (edit flow), try to fetch the post
    // server-side and inject it into the view so the editor can be prefilled
    // without an extra client request. Support numeric id or slug.
    const postParam = req.params && req.params.postId;
    let serverPost = null;
    if (postParam) {
      try {
        if (/^[0-9]+$/.test(postParam)) {
          serverPost = await postController.getPostById(postParam);
        } else {
          serverPost = await postController.getPostBySlug(postParam);
        }
      } catch (fetchErr) {
        logger.debug('[CREATEPOST] Could not fetch post for prefill:', fetchErr && fetchErr.message);
        serverPost = null;
      }
    }

    // IMPORTANT: Do NOT expose the GEMINI API key to the browser.
    applySsrNoCache(res, { varyCookie: true });
    res.render('createPost', { tinyMceKey, isAdmin, post: serverPost });
  } catch (err) {
    logger.error('[CREATEPOST] Error rendering createPost:', err);
    // Render without key (non-admin)
    applySsrNoCache(res, { varyCookie: true });
    res.render('createPost', { tinyMceKey: null, isAdmin: false, post: null });
  }
}

// Explicit routes: one without parameter and one with the parameter. Some
// environments' path parsers can't handle '?' tokens in route strings.
staticRouter.get('/createPost', handleCreatePost);
staticRouter.get('/createPost/:postId', handleCreatePost);

staticRouter.get('/about.html', (req, res) => {
  res.redirect('/about');
});

staticRouter.get('/posts', async (req, res) => {
  try {
    const isAdmin = getSsrAdmin(res);
    // Server-side render the list of current posts to preserve the
    // HTML-first experience and avoid client-side JSON-only rendering.
    const posts = await postController.getAllPosts();
    // Pass posts (controller returns JS objects); views will handle formatting
    applySsrNoCache(res, { varyCookie: true });
    return res.render('listCurrentPosts', { posts, isAdmin });
  } catch (err) {
    logger.error('[POSTS] Error rendering listCurrentPosts:', err && err.message);
    // Fallback: render without posts so client-side JS can still attempt to fetch
    const isAdmin = getSsrAdmin(res);
    applySsrNoCache(res, { varyCookie: true });
    return res.render('listCurrentPosts', { isAdmin });
  }
});

export default staticRouter;