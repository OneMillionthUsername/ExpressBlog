
import { describe, expect, it, jest, beforeEach, test } from '@jest/globals';

// Mocks müssen vor den dynamischen Imports kommen
const mockCreateComment = jest.fn();
const mockGetCommentsByPostId = jest.fn();
const mockDeleteComment = jest.fn();

// Use unstable_mockModule to register ESM mocks before imports
jest.unstable_mockModule('../models/commentModel.js', () => ({
  default: class MockComment {
    constructor(data) {
      Object.assign(this, data);
    }
    static validate = jest.fn();
  },
}));

jest.unstable_mockModule('../databases/mariaDB.js', () => ({
  DatabaseService: {
    createComment: mockCreateComment,
    getCommentsByPostId: mockGetCommentsByPostId,
    deleteComment: mockDeleteComment,
  },
}));

// Dynamic imports after mocks
const { DatabaseService } = await import('../databases/mariaDB.js');
const Comment = (await import('../models/commentModel.js')).default;
const commentController = await import('../controllers/commentController.js');

// Add the validate method to the mocked Comment class
Comment.validate = jest.fn();

// Wire DatabaseService methods to the jest mocks
DatabaseService.createComment = mockCreateComment;
DatabaseService.getCommentsByPostId = mockGetCommentsByPostId;
DatabaseService.deleteComment = mockDeleteComment;

let consoleSpy;

beforeEach(() => {
  jest.clearAllMocks();
  consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  // Set up Comment.validate mock
  Comment.validate.mockImplementation((data) => ({ error: null, value: data }));
  mockCreateComment.mockResolvedValue({ success: true, comment: { id: 1, postId: 1, username: 'Test User', text: 'Test comment', created_at: new Date() } });
  mockGetCommentsByPostId.mockResolvedValue([{
    approved: true,
    id: 1,
    postId: 1,
    username: 'Test User',
    text: 'Test comment',
    created_at: new Date('2025-08-26T12:00:00.000Z'),
    updated_at: new Date('2025-08-26T13:00:00.000Z'),
    published: true,
    ip_address: '127.0.0.1',
  }, {
    approved: true,
    id: 2,
    postId: 1,
    username: 'Test Muser',
    text: 'Test bomment',
    created_at: new Date('2025-07-26T12:00:00.000Z'),
    updated_at: new Date('2025-08-12T13:00:00.000Z'),
    published: true,
    ip_address: '127.0.0.1',
  }, {
    approved: false,
    id: 3,
    postId: 1,
    username: 'Test Muser',
    text: 'Test bomment',
    created_at: new Date('2025-07-26T12:00:00.000Z'),
    updated_at: new Date('2025-08-12T13:00:00.000Z'),
    published: true,
    ip_address: '127.0.0.1',
  }]);
  mockDeleteComment.mockResolvedValue({ success: true, message: 'Comment deleted successfully' });
});

describe('CommentController', () => {
  describe('createComment', () => {
    it('should create a comment', async () => {
      const req = {
        body: {
          postId: 1,
          username: 'Test User',
          text: 'Test comment',
          created_at: new Date(),
        },
      };
      const result = await commentController.default.createComment(req.body.postId, {
        postId: req.body.postId,
        username: req.body.username,
        text: req.body.text,
        created_at: req.body.created_at,
      });
      expect(result).toEqual({ success: true, message: 'Comment created successfully' });
    });

    it('should get valid comments by post ID', async () => {
      const req = {
        params: {
          postId: 1,
        },
      };

      const result = await commentController.default.getCommentsByPostId(req.params.postId);
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Comment);
      expect(result[0].id).toBe(1);
      expect(result[0].postId).toBe(1);
      expect(result[0].username).toBe('Test User');
      expect(result[0].text).toBe('Test comment');
      expect(result[0].approved).toBe(true);
      expect(result[0].published).toBe(true);
      expect(result[1]).toBeInstanceOf(Comment);
      expect(result[1].id).toBe(2);
      expect(result[1].postId).toBe(1);
      expect(result[1].username).toBe('Test Muser');
      expect(result[1].text).toBe('Test bomment');
      expect(result[1].approved).toBe(true);
      expect(result[1].published).toBe(true);
    });

    it('should delete a comment', async () => {
      const req = {
        params: {
          postId: 1,
          commentId: 1,
        },
      };

      const result = await commentController.default.deleteComment(req.params.commentId, req.params.postId);
      expect(result).toEqual({ success: true, message: 'Comment deleted successfully' });
    });

    it('should not delete a comment if it does not exist', async () => {
      mockDeleteComment
        .mockResolvedValueOnce({ success: false, message: 'Comment not found or not deleted' });
      const req = {
        params: {
          postId: 1,
          commentId: 999,
        },
      };
      await expect(commentController.default.deleteComment(req.params.commentId, req.params.postId))
        .rejects.toThrow('Comment not found or not deleted');
    });

    it('should handle errors when creating a comment', async () => {
      const req = {
        body: {
          postId: 1,
          username: 'Test User',
          text: 'Test comment',
          created_at: new Date(),
        },
      };
      mockCreateComment.mockRejectedValueOnce(new Error('Database error'));
      await expect(commentController.default.createComment(req.body.postId, {
        postId: req.body.postId,
        username: req.body.username,
        text: req.body.text,
        created_at: req.body.created_at,
      })).rejects.toThrow('Database error');
    });

    it('should handle errors when getting comments by post ID', async () => {
      const req = {
        params: {
          postId: 1,
        },
      };
      mockGetCommentsByPostId.mockRejectedValueOnce(new Error('Database error'));
      await expect(commentController.default.getCommentsByPostId(req.params.postId))
        .rejects.toThrow('Database error');
    });
  });
});