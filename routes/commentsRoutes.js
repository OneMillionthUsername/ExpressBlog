import express from 'express';
import { strictLimiter } from '../utils/limiters.js';
import commentsController from '../controllers/commentController.js';
import { requireAdmin, authenticateToken } from '../middleware/authMiddleware.js';
import csrfProtection from '../utils/csrf.js';
import { celebrate, Joi, Segments } from 'celebrate';

/**
 * Routes for managing comments on posts.
 *
 * - `POST /:postId` creates a new comment via HTML form (CSRF-protected).
 * - `POST /:postId/:commentId/delete` deletes a comment (admin only, HTML form).
 *
 * Validation and rate limiting are applied per-route. Controller errors
 * are expected to be thrown as exceptions and are handled by the route
 * level callers.
 */
const commentsRouter = express.Router();

commentsRouter.post('/:postId',
  strictLimiter,
  csrfProtection,
  celebrate({
    [Segments.PARAMS]: Joi.object({
      postId: Joi.number().integer().min(1).required(),
    }),
    [Segments.BODY]: Joi.object({
      username: Joi.string().max(50).allow('', null),
      text: Joi.string().min(1).max(1000).required(),
      _csrf: Joi.string().optional(),
    }),
  }),
  async (req, res) => {
    try {
      const postId = Number(req.params.postId);
      await commentsController.createCommentRecord(postId, req.body);
      const redirectTarget = req.get('Referer') || `/blogpost/by-id/${postId}`;
      return res.redirect(303, redirectTarget);
    } catch (error) {
      console.error('Error creating comment (SSR):', error);
      const redirectTarget = req.get('Referer') || `/blogpost/by-id/${req.params.postId}`;
      return res.redirect(303, redirectTarget);
    }
  },
);

commentsRouter.post('/:postId/:commentId/delete',
  strictLimiter,
  csrfProtection,
  celebrate({
    [Segments.PARAMS]: Joi.object({
      postId: Joi.number().integer().min(1).required(),
      commentId: Joi.number().integer().min(1).required(),
    }),
  }),
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const postId = Number(req.params.postId);
      const commentId = Number(req.params.commentId);
      await commentsController.deleteCommentRecord(postId, commentId);
      const redirectTarget = req.get('Referer') || `/blogpost/by-id/${postId}`;
      return res.redirect(303, redirectTarget);
    } catch (error) {
      console.error('Error deleting comment (SSR):', error);
      const redirectTarget = req.get('Referer') || `/blogpost/by-id/${req.params.postId}`;
      return res.redirect(303, redirectTarget);
    }
  },
);

export default commentsRouter;
