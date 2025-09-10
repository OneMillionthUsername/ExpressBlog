/**
 * Fehler im Controller als Exceptions werfen
 * in der Route abfangen und an das Frontend zurückgeben
 */

import express from 'express';
import postController from '../controllers/postController.js';
import { convertBigInts, incrementViews, createSlug } from '../utils/utils.js';
import { requireJsonContent } from '../middleware/securityMiddleware.js';
import { globalLimiter, strictLimiter } from '../utils/limiters.js';
import * as validationService from '../services/validationService.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import { validateId, validatePostBody, validateSlug } from '../middleware/validationMiddleware.js';
import logger from '../utils/logger.js';

const postRouter = express.Router();

// commentsRouter.all();
postRouter.get('/all', globalLimiter, async (req, res) => {
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
    
    logger.debug(`[${requestId}] GET /all: Sending successful response`);
    res.json(response);
    
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
});
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
postRouter.get('/:slug', 
  globalLimiter, 
  validateSlug,
  async (req, res) => {
    const slug = req.params.slug;
    try {
      const post = await postController.getPostBySlug(slug);
      incrementViews(req, post.id);
      res.json(convertBigInts(post) || post);
    } catch (error) {
      console.error('Error loading the blog post', error);
      res.status(500).json({ error: 'Server failed to load the blogpost' });
    }
  });
postRouter.get('/by-id/:postId', 
  globalLimiter, 
  validateId,
  async (req, res) => {
    const postId = req.params.postId;
    try {
      const post = await postController.getPostById(postId);
      incrementViews(req, postId);
      res.json(convertBigInts(post) || post);
    } catch (error) {
      console.error('Error loading the blog post', error);
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
