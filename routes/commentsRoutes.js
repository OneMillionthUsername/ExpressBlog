import express from "express";
import { requireJsonContent, validateFields } from "../middleware/securityMiddleware.js";
import { globalLimiter, strictLimiter } from "../utils/limiters.js";
import commentsController from "../controllers/commentController.js";
import { requireAdmin, authenticateToken } from "../middleware/authMiddleware.js";
import csrfProtection from "../utils/csrf.js";
import { celebrate, Joi, Segments } from 'celebrate';

const commentsRouter = express.Router();

commentsRouter.get('/:postId',
  globalLimiter,
  celebrate({
    [Segments.PARAMS]: Joi.object({
      postId: Joi.number().integer().min(1).required()
    })
  }),
  commentsController.getCommentsByPostId
);

commentsRouter.post('/:postId',
  strictLimiter,
  csrfProtection,
  requireJsonContent,
  celebrate({
    [Segments.PARAMS]: Joi.object({
      postId: Joi.number().integer().min(1).required()
    }),
    [Segments.BODY]: Joi.object({
      username: Joi.string().max(50).allow('', null),
      text: Joi.string().min(1).max(1000).required()
    })
  }),
  commentsController.addComment
);

commentsRouter.delete('/:postId/:commentId',
  strictLimiter,
  csrfProtection,
  celebrate({
    [Segments.PARAMS]: Joi.object({
      postId: Joi.number().integer().min(1).required(),
      commentId: Joi.number().integer().min(1).required()
    })
  }),
  requireJsonContent,
  requireAdmin,
  authenticateToken,
  commentsController.deleteComment
);

export default commentsRouter;
