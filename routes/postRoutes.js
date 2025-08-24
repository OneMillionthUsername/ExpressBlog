/**
 * Fehler im Controller als Exceptions werfen
 * in der Route abfangen und an das Frontend zurückgeben
 */

import express from 'express';
import * as postController from '../controllers/postController.js';
import { convertBigInts, incrementViews, createSlug } from '../utils/utils.js';
import { requireJsonContent } from '../middleware/securityMiddleware.js';
import { globalLimiter, strictLimiter } from '../utils/limiters.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import { validateId, validatePostBody, validateSlug } from '../middleware/validationMiddleware.js';

const postRouter = express.Router();
// postRouter.all('*', async (req, res, next) => {
//   //hier allgemeine Logik ausführen
//   //logging
//   //sanitazing
//   next();
// });

// commentsRouter.all();
postRouter.get('/all', globalLimiter, async (req, res) => {
  try {
    const posts = await postController.getAllPosts();
    res.json(convertBigInts(posts) || posts);
  } catch (error) {
    console.error('Error loading blog posts', error);
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
postRouter.get('/by-id/:post_id', 
  globalLimiter, 
  validateId,
  async (req, res) => {
  const postId = req.params.post_id;
  try {
    const post = await postController.getPostById(postId);
    incrementViews(req, postId);
    res.json(convertBigInts(post) || post);
  } catch (error) {
    console.error('Error loading the blog post', error);
    res.status(500).json({ error: 'Server failed to load the blogpost' });
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
postRouter.put('/update/:post_id',
  strictLimiter,
  requireJsonContent,
  validateId,
  validatePostBody,
  requireAdmin,
  authenticateToken,
  async (req, res) => {
    const postId = req.params.post_id;
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
  '/delete/:post_id',
  strictLimiter,
  requireJsonContent,
  validateId,
  requireAdmin,
  authenticateToken,
  async (req, res) => {
    const postId = req.params.post_id;
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
