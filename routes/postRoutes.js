/**
 * Fehler im Controller als Exceptions werfen
 * in der Route abfangen und an das Frontend zurückgeben
 */

import express from 'express';
import crypto from 'crypto';
import postController from '../controllers/postController.js';
import { PostControllerException } from '../models/customExceptions.js';
import { convertBigInts, incrementViews, createSlug } from '../utils/utils.js';
import simpleCache from '../utils/simpleCache.js';
import { requireJsonContent } from '../middleware/securityMiddleware.js';
import { globalLimiter, strictLimiter } from '../utils/limiters.js';
import * as validationService from '../services/validationService.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import { validateId, validatePostBody, validateSlug } from '../middleware/validationMiddleware.js';
import logger from '../utils/logger.js';
import { escapeAllStrings } from '../utils/utils.js';

const postRouter = express.Router();

// commentsRouter.all();
async function getAllHandler(req, res) {
  const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  logger.debug(`[${requestId}] GET /all: Request received`, {
    headers: {
      'user-agent': req.get('User-Agent'),
      'referer': req.get('Referer'),
      'x-forwarded-for': req.get('X-Forwarded-For'),
      'host': req.get('Host'),
    },
    query: req.query,
    ip: req.ip,
    method: req.method,
    url: req.originalUrl,
  });
  
  try {
    logger.debug(`[${requestId}] GET /all: Checking cache for all posts`);
    const cacheKey = 'posts:all';
    let posts = simpleCache.get(cacheKey);
    let controllerDuration = null;
    if (!posts) {
      logger.debug(`[${requestId}] GET /all: Cache miss - loading posts from controller`);
      const controllerStartTime = Date.now();
      posts = await postController.getAllPosts();
      const controllerEndTime = Date.now();
      controllerDuration = controllerEndTime - controllerStartTime;
      logger.debug(`[${requestId}] GET /all: Controller returned in ${controllerDuration}ms`);
      // Cache the result for 60 seconds
      simpleCache.set(cacheKey, posts, 60 * 1000);
    } else {
      controllerDuration = 'cache';
      logger.debug(`[${requestId}] GET /all: Cache hit - returning cached posts`);
    }
    
    logger.debug(`[${requestId}] GET /all: Controller returned data`, {
      posts_count: posts ? posts.length : 'null',
      posts_type: typeof posts,
      posts_is_array: Array.isArray(posts),
      controller_duration_ms: controllerDuration,
      first_post_sample: posts && posts.length > 0 ? {
        id: posts[0].id,
        title: posts[0].title?.substring(0, 50),
        slug: posts[0].slug,
      } : null,
    });
    
    // Auch leere Arrays sind gültige Antworten
    const response = convertBigInts(posts) || [];
    logger.debug(`[${requestId}] GET /all: Prepared response`, {
      response_length: response.length,
      response_type: typeof response,
      response_is_array: Array.isArray(response),
      conversion_applied: 'convertBigInts',
    });
    
    // Prefer controller-provided checksum as ETag to avoid hashing the full payload on every request.
    try {
      let etag;
      try {
        const checksum = typeof postController.getPostsChecksum === 'function' ? await postController.getPostsChecksum() : null;
        if (checksum) {
          etag = `"${checksum}"`;
          logger.debug(`[${requestId}] GET /all: Using controller checksum for ETag`);
        }
      } catch (innerErr) {
        // If controller checksum retrieval fails, fall back to hashing below
        logger.debug(`[${requestId}] GET /all: Controller checksum retrieval failed: ${innerErr.message}`);
      }

      // If we don't have an etag yet, compute it from the response body (SHA-1). Quoted per RFC.
      if (!etag) {
        const bodyString = JSON.stringify(response);
        const hash = crypto.createHash('sha1').update(bodyString).digest('hex');
        etag = `"${hash}"`;
        logger.debug(`[${requestId}] GET /all: Computed ETag from response body`);
      }

      const incoming = req.get('If-None-Match');
      if (incoming && incoming === etag) {
        logger.debug(`[${requestId}] GET /all: ETag matched - returning 304`);
        res.status(304).set('ETag', etag).end();
        return;
      }

      // Set ETag and Cache-Control for short client-side caching
      res.set('ETag', etag);
      // Clients may cache for a short duration; server still validates with If-None-Match
      res.set('Cache-Control', 'private, max-age=30, must-revalidate');

      logger.debug(`[${requestId}] GET /all: Sending successful response with ETag`);
      // Determine whether this request should be treated as an API call (JSON)
      // or a browser navigation (HTML). We treat it as API if any of the
      // following are true:
      // - explicit ?format=json query parameter
      // - X-Requested-With header set to XMLHttpRequest (typical for XHR/fetch)
      // - Accept header explicitly asks for JSON or does not explicitly prefer HTML
      const wantsJsonParam = req.query && String(req.query.format).toLowerCase() === 'json';
      const isAjax = (req.get && String(req.get('X-Requested-With') || '').toLowerCase()) === 'xmlhttprequest';
      const acceptsHtml = req.accepts && req.accepts('html');
      const acceptsJson = req.accepts && req.accepts('json');

      // If the request is clearly an API/XHR request, return JSON
      if (wantsJsonParam || isAjax || (!acceptsHtml && acceptsJson)) {
        try {
          const safe = Array.isArray(response) ? response.map(p => escapeAllStrings(p, ['content', 'description'])) : response;
          return res.json(safe);
        } catch (_e) {
          return res.json(response);
        }
      }

      // Otherwise render HTML for human-driven browser navigation
      try {
        const safePosts = Array.isArray(response) ? response.map(p => escapeAllStrings(p, ['content', 'description'])) : response;
        return res.render('listCurrentPosts', { posts: safePosts });
      } catch (_e) {
        return res.render('listCurrentPosts', { posts: response });
      }
    } catch (err) {
      logger.error(`[${requestId}] GET /all: Error computing ETag: ${err.message}`);
      // Fallback: send response without ETag
      res.json(response);
    }
    
  } catch (error) {
    logger.debug(`[${requestId}] GET /all: Error occurred`, {
      error_message: error.message,
      error_name: error.name,
      error_stack: error.stack,
      error_type: typeof error,
    });
    console.error('Error loading blog posts', error);
    logger.error(`[${requestId}] GET /all route error: ${error.message}`);
    res.status(500).json({ error: 'Server failed to load blog posts' });
  }
}

postRouter.get('/all', globalLimiter, getAllHandler);

// Export handler for integration tests
export { getAllHandler };
// Spezifische Routen VOR parametrische Routen
postRouter.get('/most-read', globalLimiter, async (req, res) => {
  const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  logger.debug(`[${requestId}] GET /most-read: Request received ${req.originalUrl} accept=${req.get('Accept')} xreq=${req.get('X-Requested-With')} host=${req.get('Host')}`);
  try {
    const cacheKey = 'posts:mostRead';
    let posts = simpleCache.get(cacheKey);
    if (posts) {
      logger.debug(`[${requestId}] GET /most-read: Cache hit for ${cacheKey}, returning cached posts_count=${Array.isArray(posts) ? posts.length : 'unknown'}`);
    } else {
      logger.debug(`[${requestId}] GET /most-read: Cache miss for ${cacheKey} - loading from controller`);
      try {
        posts = await postController.getMostReadPosts();
      } catch (ctlErr) {
        // If the controller threw because there were no valid published posts,
        // try a direct, efficient DB query that selects the top published
        // posts ordered by views. This avoids loading the entire posts set.
        if (ctlErr instanceof PostControllerException) {
          logger.debug(`[${requestId}] GET /most-read: Controller threw PostControllerException - attempting direct DB fallback query`);
          try {
            const dbModule = await import('../databases/mariaDB.js');
            let conn;
            try {
              conn = await dbModule.getDatabasePool().getConnection();
              const rows = await conn.query('SELECT id, slug, title, content, views, created_at FROM posts WHERE published = 1 ORDER BY views DESC LIMIT 5');
              posts = Array.isArray(rows) ? rows.map(p => convertBigInts(p)) : [];
              logger.debug(`[${requestId}] GET /most-read: Direct DB fallback returned ${Array.isArray(posts) ? posts.length : 'null'} rows`);
            } finally {
              if (conn && typeof conn.release === 'function') conn.release();
            }
          } catch (_fallbackErr) {
            // fallback failed - leave posts as empty array and allow outer logic
            posts = [];
          }
        } else {
          // Non-controller errors should bubble out to be handled by outer try/catch
          throw ctlErr;
        }
      }

      // Cache most-read for a short period to keep results relatively fresh while
      // avoiding DB pressure from many concurrent visitors. TTL: 60 seconds.
      simpleCache.set(cacheKey, posts, 60 * 1000);
      logger.debug(`[${requestId}] GET /most-read: Cached ${cacheKey} posts_count=${Array.isArray(posts) ? posts.length : 'unknown'} ttl_ms=${60 * 1000}`);
    }
    const response = convertBigInts(posts) || posts;

    // Content negotiation: prefer JSON if explicit ?format=json, X-Requested-With is XHR,
    // or Accept header prefers JSON over HTML. Otherwise render HTML view for browsers.
    const wantsJsonParam = req.query && String(req.query.format || '').toLowerCase() === 'json';
    const isAjax = (req.get && String(req.get('X-Requested-With') || '').toLowerCase()) === 'xmlhttprequest';
    const acceptsHtml = req.accepts && req.accepts('html');
    const acceptsJson = req.accepts && req.accepts('json');

    if (wantsJsonParam || isAjax || (!acceptsHtml && acceptsJson)) {
      try {
        const safe = Array.isArray(response) ? response.map(p => escapeAllStrings(p, ['content', 'description'])) : response;
        return res.json(safe);
      } catch (_e) {
        return res.json(response);
      }
    }

    try {
      const safePosts = Array.isArray(response) ? response.map(p => escapeAllStrings(p, ['content', 'description'])) : response;
      return res.render('mostReadPosts', { posts: safePosts });
    } catch (_e) {
      return res.render('mostReadPosts', { posts: response });
    }
  } catch (error) {
    console.error('Error loading most read blog posts', error);
    // If the controller indicates there are simply no valid published posts,
    // log at WARN level to avoid noisy error logs. For other errors, keep ERROR.
    if (error instanceof PostControllerException) {
      logger.warn(`[${requestId}] GET /most-read route: ${error && error.message ? error.message : String(error)}`);
    } else {
      logger.error(`[${requestId}] GET /most-read route error: ${error && error.message ? error.message : String(error)}`);
    }
    // If the client expects HTML (regular browser navigation), render the
    // `mostReadPosts` view with a friendly message. For API/JS clients, return
    // JSON. When there are simply no most-read posts (PostControllerException),
    // return an empty array with 200 for API/XHR clients so the frontend can
    // gracefully fall back instead of logging noisy 404s.
    const acceptsHtml = req.accepts && req.accepts('html');
    if (acceptsHtml && !req.is('application/json')) {
      const message = (error instanceof PostControllerException)
        ? 'No most-read blog posts found'
        : 'Server error while loading most-read blog posts';
      // Render a friendly page for browsers. When there are simply no most-read
      // posts, return 200 so the browser doesn't treat the page as a missing
      // resource. Server errors still return 500.
      return res.status(error instanceof PostControllerException ? 200 : 500).render('mostReadPosts', { posts: null, errorMessage: message });
    }

    // API / XHR clients
    if (error instanceof PostControllerException) {
      // Treat 'no posts' as empty result for API consumers to avoid noisy 404
      // in the client console; client-side code will fall back appropriately.
      return res.status(200).json([]);
    }
    return res.status(500).json({ error: 'Server failed to load most read blog posts' });
  }
});
// Admin-only endpoint to clear the most-read cache
postRouter.post('/admin/cache/clear-most-read', globalLimiter, authenticateToken, requireAdmin, async (req, res) => {
  try {
    simpleCache.del('posts:mostRead');
    // Return 204 No Content to avoid exposing payload
    return res.status(204).end();
  } catch (error) {
    console.error('Error clearing most-read cache:', error);
    return res.status(500).json({ error: 'Failed to clear cache' });
  }
});
// Numeric ID route should come BEFORE the slug route to avoid numeric slugs being
// misinterpreted as human-readable slugs. Example: /blogpost/59 -> by-id route.
postRouter.get('/by-id/:postId', 
  globalLimiter, 
  validateId,
  async (req, res) => {
    const postId = req.params.postId;
    try {
      const post = await postController.getPostById(postId);
      // Only increment views if we got a valid post object
      if (post && post.id) {
        incrementViews(req, post.id);
      }
      const safe = convertBigInts(post) || post;
      try {
        const sanitized = escapeAllStrings(safe, ['content', 'description']);
        if (req.accepts && req.accepts('html') && !req.is('application/json')) {
          return res.render('readPost', { post: sanitized });
        }
        return res.json(sanitized);
      } catch (_e) {
        if (req.accepts && req.accepts('html') && !req.is('application/json')) {
          return res.render('readPost', { post: safe });
        }
        return res.json(safe);
      }
    } catch (error) {
      console.error('Error loading the blog post by id', error);
      if (error instanceof PostControllerException) {
        return res.status(404).json({ error: 'Blogpost not found' });
      }
      res.status(500).json({ error: 'Server failed to load the blogpost' });
    }
  });

// JSON-only alias routes under /api/blogpost to avoid reliance on Accept/X-Requested-With
// These endpoints always return JSON regardless of Accept headers or request content type.
postRouter.get('/api/by-id/:postId', globalLimiter, validateId, async (req, res) => {
  const postId = req.params.postId;
  try {
    const post = await postController.getPostById(postId);
    if (post && post.id) incrementViews(req, post.id);
    const safe = convertBigInts(post) || post;
    try {
      return res.json(escapeAllStrings(safe, ['content', 'description']));
    } catch (_e) {
      return res.json(safe);
    }
  } catch (error) {
    console.error('Error loading the blog post by id (api):', error);
    if (error instanceof PostControllerException) return res.status(404).json({ error: 'Blogpost not found' });
    return res.status(500).json({ error: 'Server failed to load the blogpost' });
  }
});

postRouter.get('/api/:slug', globalLimiter, validateSlug, async (req, res) => {
  const slug = req.params.slug;
  try {
    const post = await postController.getPostBySlug(slug);
    if (post && post.id) incrementViews(req, post.id);
    return res.json(convertBigInts(post) || post);
  } catch (error) {
    console.error('Error loading the blog post by slug (api):', error);
    if (error instanceof PostControllerException) return res.status(404).json({ error: 'Blogpost not found' });
    return res.status(500).json({ error: 'Server failed to load the blogpost' });
  }
});

// Support shorthand numeric URL: /blogpost/59
// This route must be declared BEFORE the slug route so numeric paths are
// interpreted as IDs and not validated as slugs.
postRouter.get('/:maybeId',
  globalLimiter,
  async (req, res, next) => {
    const maybe = req.params.maybeId;
    // If this is not numeric, pass to the slug route by calling next()
    if (!/^[0-9]+$/.test(maybe)) {
      return next();
    }
    const postId = maybe;
    try {
      const post = await postController.getPostById(postId);
      if (post && post.id) incrementViews(req, post.id);
      const safe = convertBigInts(post) || post;
      try {
        const sanitized = escapeAllStrings(safe, ['content', 'description']);
        if (req.accepts && req.accepts('html') && !req.is('application/json')) {
          return res.render('readPost', { post: sanitized });
        }
        return res.json(sanitized);
      } catch (_e) {
        if (req.accepts && req.accepts('html') && !req.is('application/json')) {
          return res.render('readPost', { post: safe });
        }
        return res.json(safe);
      }
    } catch (error) {
      console.error('Error loading the blog post by numeric id', error);
      if (error instanceof PostControllerException) {
        return res.status(404).json({ error: 'Blogpost not found' });
      }
      return res.status(500).json({ error: 'Server failed to load the blogpost' });
    }
  });

// Slug-based route (human readable) - validated via validateSlug
postRouter.get('/:slug', 
  globalLimiter, 
  validateSlug,
  async (req, res) => {
    const slug = req.params.slug;
    try {
      const post = await postController.getPostBySlug(slug);
      if (post && post.id) incrementViews(req, post.id);
      // If the client expects HTML (browser), render the readPost view
      if (req.accepts && req.accepts('html') && !req.is('application/json')) {
        return res.render('readPost', { post: convertBigInts(post) || post });
      }
      // Otherwise return JSON for API/JS clients
      return res.json(convertBigInts(post) || post);
    } catch (error) {
      console.error('Error loading the blog post by slug', error);
      // If the client expects HTML, render the view with a friendly message
      if (req.accepts && req.accepts('html') && !req.is('application/json')) {
        const message = (error instanceof PostControllerException) ? 'Blogpost nicht gefunden' : 'Serverfehler beim Laden des Blogposts';
        return res.status(error instanceof PostControllerException ? 404 : 500).render('readPost', { post: null, errorMessage: message });
      }
      if (error instanceof PostControllerException) {
        return res.status(404).json({ error: 'Blogpost not found' });
      }
      return res.status(500).json({ error: 'Server failed to load the blogpost' });
    }
  });
postRouter.get('/archive', globalLimiter, async (req, res) => {
  try {
    const cacheKey = 'posts:archive';
    let posts = simpleCache.get(cacheKey);
    if (!posts) {
      posts = await postController.getArchivedPosts();
      simpleCache.set(cacheKey, posts);
    }
    const response = convertBigInts(posts) || posts;
    try {
      const safeResponse = Array.isArray(response) ? response.map(p => escapeAllStrings(p, ['content', 'description'])) : response;
      if (req.accepts && req.accepts('html') && !req.is('application/json')) {
        return res.render('archiv', { posts: safeResponse });
      }
      return res.json(safeResponse);
    } catch (_e) {
      if (req.accepts && req.accepts('html') && !req.is('application/json')) {
        return res.render('archiv', { posts: response });
      }
      return res.json(response);
    }
  } catch (error) {
    console.error('Error loading archived blog posts', error);
    res.status(500).json({ error: 'Server failed to load archived blog posts' });
  }
});
postRouter.post('/create', 
  strictLimiter,
  requireJsonContent,
  validatePostBody, 
  requireAdmin, 
  authenticateToken, 
  async (req, res) => {
    const { title, content, tags } = req.body;
    const slug = createSlug(title);
    try {
      const result = await postController.createPost({ title, slug, content, tags, author: req.user.username });
      if (!result) {
        return res.status(400).json({ error: 'Failed to create blog post' });
      }
      res.status(201).json({ message: 'Blog post created successfully', postId: Number(result.postId), title: result.title });
      // Invalidate cached lists
      try {
        simpleCache.del('posts:all');
        simpleCache.del('posts:mostRead');
        simpleCache.del('posts:archive');
        const _id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        logger.debug(`[${_id}] POST /create: invalidated caches posts:all, posts:mostRead, posts:archive`);
      } catch (e) { void e; }
    } catch (error) {
      console.error('Error creating new blog post', error);
      res.status(500).json({ error: 'Server failed to create the blogpost' });
    }
  });
postRouter.put('/update/:postId',
  strictLimiter,
  requireJsonContent,
  validateId,
  validatePostBody,
  requireAdmin,
  authenticateToken,
  async (req, res) => {
    const postId = req.params.postId;
    const { title, content, tags } = req.body;
    try {
      const result = await postController.updatePost(postId, { title, content, tags });
      if (!result) {
        return res.status(400).json({ error: 'Failed to update blog post' });
      }
      res.status(200).json({ message: 'Blog post updated successfully', postId: Number(result.postId), title: result.title });
      try {
        simpleCache.del('posts:all');
        simpleCache.del('posts:mostRead');
        simpleCache.del('posts:archive');
        const _id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        logger.debug(`[${_id}] PUT /update: invalidated caches posts:all, posts:mostRead, posts:archive`);
      } catch (e) { void e; }
    } catch (error) {
      console.error('Error updating blog post', error);
      res.status(500).json({ error: 'Server failed to update the blogpost' });
    }
  });
postRouter.delete(
  '/delete/:postId',
  strictLimiter,
  requireJsonContent,
  validateId,
  requireAdmin,
  authenticateToken,
  async (req, res) => {
    const postId = req.params.postId;
    if (validationService.validateId(postId) === false) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }
    try {
      const result = await postController.deletePost(postId);
      if (!result) {
        return res.status(400).json({ error: 'Failed to delete blog post' });
      }
      res.status(200).json({ message: 'Blog post deleted successfully', postId: Number(result.postId) });
      try {
        simpleCache.del('posts:all');
        simpleCache.del('posts:mostRead');
        simpleCache.del('posts:archive');
        const _id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        logger.debug(`[${_id}] DELETE /delete: invalidated caches posts:all, posts:mostRead, posts:archive`);
      } catch (e) { void e; }
    } catch (error) {
      console.error('Error deleting blog post', error);
      res.status(500).json({ error: 'Server failed to delete the blogpost' });
    }
  });

export default postRouter;
