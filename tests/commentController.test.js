import { describe, expect, it, jest, beforeEach, test } from '@jest/globals';

jest.unstable_mockModule('../databases/mariaDB.js', () => ({
    DatabaseService: {
        createComment: jest.fn().mockResolvedValue({ success: true, comment: { id: 1, postId: 1, username: 'Test User', text: 'Test comment', created_at: new Date() } }),
        getCommentsByPostId: jest.fn().mockResolvedValue([{
            approved: true,
            id: 1,
            postId: 1,
            username: 'Test User',
            text: 'Test comment',
            created_at: new Date('2025-08-26T12:00:00.000Z'),
            updated_at: new Date('2025-08-26T13:00:00.000Z'),
            published: true,
            ip_address: '127.0.0.1'
        }, {
            approved: true,
            id: 2,
            postId: 1,
            username: 'Test Muser',
            text: 'Test bomment',
            created_at: new Date('2025-07-26T12:00:00.000Z'),
            updated_at: new Date('2025-08-12T13:00:00.000Z'),
            published: true,
            ip_address: '127.0.0.1'
        }, {
            approved: false,
            id: 3,
            postId: 1,
            username: 'Test Muser',
            text: 'Test bomment',
            created_at: new Date('2025-07-26T12:00:00.000Z'),
            updated_at: new Date('2025-08-12T13:00:00.000Z'),
            published: true,
            ip_address: '127.0.0.1'
        }]),
        deleteComment: jest.fn().mockResolvedValue({ success: true, message: 'Comment deleted successfully' }),
    }
}));

let commentController;
let DatabaseService;

beforeEach(async () => {
  jest.clearAllMocks();
  commentController = (await import('../controllers/commentController.js')).default;
  DatabaseService = (await import('../databases/mariaDB.js')).DatabaseService;
});
describe('Comment Controller', () => {

  it('should create a comment', async () => {
    const req = {
      body: {
        postId: 1,
        username: 'Test User',
        text: 'Test comment',
        created_at: new Date(),
      },
    };
    const result = await commentController.createComment(req.body.postId, {
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

    const result = await commentController.getCommentsByPostId(req.params.postId);
    console.log(result[0].approved);
    console.log(result[0].published);
    console.log(result[0].ip_address);
    expect(result).toEqual([{
            approved: true,
            id: 1,
            postId: 1,
            username: 'Test User',
            text: 'Test comment',
            created_at: new Date('2025-08-26T12:00:00.000Z'),
            updated_at: new Date('2025-08-26T13:00:00.000Z'),
            published: true,
            ip_address: '127.0.0.1'
        }, {
            approved: true,
            id: 2,
            postId: 1,
            username: 'Test Muser',
            text: 'Test bomment',
            created_at: new Date('2025-07-26T12:00:00.000Z'),
            updated_at: new Date('2025-08-12T13:00:00.000Z'),
            published: true,
            ip_address: '127.0.0.1'
        }]);
  });
  it('should delete a comment', async () => {
    const req = {
      params: {
        postId: 1,
        commentId: 1,
      },
    };

    const result = await commentController.deleteComment(req.params.postId, req.params.commentId);
    expect(result).toEqual({ success: true, message: 'Comment deleted successfully' });
  });
    it('should not delete a comment if it does not exist', async () => {
    DatabaseService.deleteComment
      .mockResolvedValueOnce({ success: false, message: 'Comment not found or not deleted' });
   const req = {
        params: {
        postId: 1,
        commentId: 999,
        },
    };
    await expect(commentController.deleteComment(req.params.postId, req.params.commentId))
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
    DatabaseService.createComment.mockRejectedValue(new Error('Database error'));
    await expect(commentController.createComment(req.body.postId, {
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
    DatabaseService.getCommentsByPostId.mockRejectedValue(new Error('Database error'));
    await expect(commentController.getCommentsByPostId(req.params.postId))
      .rejects.toThrow('Database error');
  });
});