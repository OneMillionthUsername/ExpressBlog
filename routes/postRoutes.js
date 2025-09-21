/**
 * Fehler im Controller als Exceptions werfen
 * in der Route abfangen und an das Frontend zurückgeben
 */

import express from 'express';
import crypto from 'crypto';
import postController from '../controllers/postController.js';
import { PostControllerException } from '../models/customExceptions.js';
import { convertBigInts, incrementViews, createSlug } from '../utils/utils.js';
import { requireJsonContent } from '../middleware/securityMiddleware.js';
import { globalLimiter, strictLimiter } from '../utils/limiters.js';
import * as validationService from '../services/validationService.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import { validateId, validatePostBody, validateSlug } from '../middleware/validationMiddleware.js';
import logger from '../utils/logger.js';

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
    logger.debug(`[${requestId}] GET /all: Calling postController.getAllPosts()`);
    const controllerStartTime = Date.now();
    
    const posts = await postController.getAllPosts();
    
    const controllerEndTime = Date.now();
    const controllerDuration = controllerEndTime - controllerStartTime;
    
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
      res.json(response);
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
  try {
    const posts = await postController.getMostReadPosts();
    res.json(convertBigInts(posts) || posts);
  } catch (error) {
    console.error('Error loading most read blog posts', error);
    res.status(500).json({ error: 'Server failed to load most read blog posts' });
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
      res.json(convertBigInts(post) || post);
    } catch (error) {
      console.error('Error loading the blog post by id', error);
      if (error instanceof PostControllerException) {
        return res.status(404).json({ error: 'Blogpost not found' });
      }
      res.status(500).json({ error: 'Server failed to load the blogpost' });
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
      return res.json(convertBigInts(post) || post);
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
      res.json(convertBigInts(post) || post);
    } catch (error) {
      console.error('Error loading the blog post by slug', error);
      if (error instanceof PostControllerException) {
        return res.status(404).json({ error: 'Blogpost not found' });
      }
      res.status(500).json({ error: 'Server failed to load the blogpost' });
    }
  });
postRouter.get('/archive', globalLimiter, async (req, res) => {
  try {
    const posts = await postController.getArchivedPosts();
    res.json(convertBigInts(posts) || posts);
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
    } catch (error) {
      console.error('Error deleting blog post', error);
      res.status(500).json({ error: 'Server failed to delete the blogpost' });
    }
  });

export default postRouter;
