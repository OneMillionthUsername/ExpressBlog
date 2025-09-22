import { DatabaseService } from '../databases/mariaDB.js';
import Comment from '../models/commentModel.js';
import { CommentControllerException } from '../models/customExceptions.js';
import { sanitizeHtml } from '../utils/sanitizer.js';
import { escapeHtml } from '../utils/utils.js';

const createComment = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const commentData = {
      ...req.body,
      postId: postId,
      created_at: new Date(),
      approved: true,
      published: true,
    };
    
    const { error, value } = Comment.validate(commentData);
    if (error) {
      throw new CommentControllerException(
        'Validation failed: ' + error.details.map(d => d.message).join('; '),
        { validationErrors: error.details },
      );
    }
    
    // Server-side sanitization: allow only safe HTML in comment text and
    // ensure username is plain text (no tags/styles). This prevents stored
    // content from containing inline style attributes that violate CSP.
    try {
      value.text = sanitizeHtml(String(value.text || ''));
    } catch (_e) {
      value.text = escapeHtml(String(value.text || ''));
    }
    if (!value.username || String(value.username).trim() === '') {
      value.username = 'Anonym';
    } else {
      value.username = escapeHtml(String(value.username));
    }
    
    const result = await DatabaseService.createComment(postId, value);
    if (!result || result.affectedRows === 0) {
      throw new CommentControllerException(
        'Failed to save comment to database',
        { postId, commentData: value, dbResult: result },
      );
    }
    
    res.json({ success: true, message: 'Comment created successfully' });
  } catch (error) {
    console.error('Error creating comment:', error);
    
    if (error instanceof CommentControllerException) {
      return res.status(400).json({ 
        error: error.message,
        details: error.details, 
      });
    }
    
    res.status(500).json({ error: 'Failed to create comment' });
  }
};
const getCommentsByPostId = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    if (isNaN(postId) || postId <= 0) {
      throw new CommentControllerException(
        'Invalid post ID provided',
        { providedPostId: req.params.postId },
      );
    }
    
    const comments = await DatabaseService.getCommentsByPostId(postId);
    if (!comments || comments.length === 0) {
      return res.json([]);
    }
    
    const validComments = [];
    for (const comment of comments) {
      // Add missing required fields for validation
      const commentData = {
        ...comment,
        postId: postId,
      };
      
      const { error, value } = Comment.validate(commentData);
      if (error) {
        console.error('Validation failed for comment:', error.details.map(d => d.message).join('; '));
        continue;
      }
      
      validComments.push(new Comment(value));
    }
    res.json(validComments);
  } catch (error) {
    console.error('Error getting comments:', error);
    
    if (error instanceof CommentControllerException) {
      return res.status(400).json({ 
        error: error.message,
        details: error.details, 
      });
    }
    
    res.status(500).json({ error: 'Failed to load comments' });
  }
};
const deleteComment = async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    const postId = parseInt(req.params.postId);
    
    if (isNaN(commentId) || commentId <= 0) {
      throw new CommentControllerException(
        'Invalid comment ID provided',
        { providedCommentId: req.params.commentId },
      );
    }
    
    if (isNaN(postId) || postId <= 0) {
      throw new CommentControllerException(
        'Invalid post ID provided',
        { providedPostId: req.params.postId },
      );
    }
    
    const result = await DatabaseService.deleteComment(commentId, postId);
    if (!result || !result.success) {
      throw new CommentControllerException(
        'Comment not found or deletion failed',
        { commentId, postId, dbResult: result },
      );
    }
    
    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    
    if (error instanceof CommentControllerException) {
      return res.status(400).json({ 
        error: error.message,
        details: error.details, 
      });
    }
    
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};
export default {
  createComment,
  getCommentsByPostId,
  deleteComment,
};