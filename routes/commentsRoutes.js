import express from "express";
import { requireJsonContent } from "../middleware/securityMiddleware.js";
import { globalLimiter, strictLimiter } from "../utils/limiters.js";
import commentsController from "../controllers/commentController.js";
import { requireAdmin, authenticateToken } from "../middleware/authMiddleware.js";
import csrfProtection from "../utils/csrf.js";

const commentsRouter = express.Router();

commentsRouter.get('/:postId', globalLimiter, commentsController.getCommentsByPostId);
commentsRouter.post('/', csrfProtection, requireJsonContent, strictLimiter, commentsController.addComment);
commentsRouter.delete('/:postId/:commentId', csrfProtection, requireJsonContent, requireAdmin, authenticateToken, strictLimiter, commentsController.deleteComment);

export default commentsRouter;
