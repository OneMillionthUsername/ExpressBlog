import express from "express";
import { requireJsonContent } from "../middleware/securityMiddleware";
import { globalLimiter, strictLimiter } from "../utils/limiters.js";
import * as commentsController from "../controllers/commentsController.js";
import { requireAdmin, authenticateToken } from "../middleware/authMiddleware";
import { csrfProtection } from "../utils/csrf.js";

const commentsRouter = express.Router();

commentsRouter.post('/', csrfProtection, requireJsonContent, strictLimiter, commentsController.addComment);
commentsRouter.delete('/:postId/:commentId', csrfProtection, requireJsonContent, requireAdmin, authenticateToken, strictLimiter, commentsController.deleteComment);
commentsRouter.get('/:postId', globalLimiter, commentsController.getCommentsByPostId);

export default commentsRouter;
