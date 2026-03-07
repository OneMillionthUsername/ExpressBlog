/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock DatabaseService and logger before importing the controller
const mockDb = {
  getPostBySlug: jest.fn(),
  getAllPosts: jest.fn(),
  getPostById: jest.fn(),
  createPost: jest.fn(),
  updatePost: jest.fn(),
  getMostReadPosts: jest.fn(),
  deletePost: jest.fn(),
  getArchivedPosts: jest.fn(),
  getArchivedYears: jest.fn(),
  getPostsByCategory: jest.fn(),
  getPostsByCategoryId: jest.fn(),
};

jest.unstable_mockModule('../databases/mariaDB.js', () => ({
  DatabaseService: mockDb,
}));

jest.unstable_mockModule('../utils/logger.js', () => ({
  default: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
}));

const { default: postController } = await import('../controllers/postController.js');
const { PostControllerException } = await import('../models/customExceptions.js');
const { Post } = await import('../models/postModel.js');

// A valid post fixture that satisfies the Joi schema (category_id is required)
const makePost = (overrides = {}) => ({
  id: 1,
  slug: 'test-post',
  title: 'Test Post Title',
  content: '<p>Test content</p>',
  tags: ['test'],
  author: 'Test Author',
  views: 10,
  published: true,
  created_at: new Date('2025-01-01'),
  updated_at: new Date('2025-01-01'),
  category_id: 1,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('postController', () => {
  describe('getPostBySlug', () => {
    it('throws when post is not found', async () => {
      mockDb.getPostBySlug.mockResolvedValue(null);
      await expect(postController.getPostBySlug('test-post'))
        .rejects.toThrow(PostControllerException);
      await expect(postController.getPostBySlug('test-post'))
        .rejects.toThrow('Post not found or not published');
    });

    it('throws when post is not published', async () => {
      mockDb.getPostBySlug.mockResolvedValue(makePost({ published: false }));
      await expect(postController.getPostBySlug('test-post'))
        .rejects.toThrow('Post not found or not published');
    });

    it('returns a Post instance for a valid published post', async () => {
      const data = makePost();
      mockDb.getPostBySlug.mockResolvedValue(data);
      const result = await postController.getPostBySlug('test-post');
      expect(result).toBeInstanceOf(Post);
      expect(result.slug).toBe('test-post');
      expect(result.published).toBe(true);
    });

    it('throws when DB throws', async () => {
      mockDb.getPostBySlug.mockRejectedValue(new Error('DB down'));
      await expect(postController.getPostBySlug('test-post'))
        .rejects.toThrow(PostControllerException);
    });
  });

  describe('getPostById', () => {
    it('throws when post is not found', async () => {
      mockDb.getPostById.mockResolvedValue(null);
      await expect(postController.getPostById(1))
        .rejects.toThrow('Post not found');
    });

    it('throws when post is not published', async () => {
      mockDb.getPostById.mockResolvedValue(makePost({ published: false }));
      await expect(postController.getPostById(1))
        .rejects.toThrow('Blogpost deleted/not published');
    });

    it('returns a Post instance for a valid post', async () => {
      mockDb.getPostById.mockResolvedValue(makePost());
      const result = await postController.getPostById(1);
      expect(result).toBeInstanceOf(Post);
      expect(result.id).toBe(1);
    });
  });

  describe('createPost', () => {
    it('throws immediately on Joi validation failure (not wrapped)', async () => {
      // title is required and min 3 chars
      await expect(postController.createPost({ slug: 'ab', title: '', content: 'x', category_id: 1 }))
        .rejects.toThrow('Validation failed:');
      // slug must be at least 3 chars
      await expect(postController.createPost({ slug: 'ab', title: 'Valid Title', content: 'x', category_id: 1 }))
        .rejects.toThrow('Validation failed:');
    });

    it('creates a post and returns a Post instance', async () => {
      const created = makePost();
      mockDb.createPost.mockResolvedValue(created);
      const result = await postController.createPost(makePost({ id: undefined }));
      expect(result).toBeInstanceOf(Post);
      expect(mockDb.createPost).toHaveBeenCalledTimes(1);
    });

    it('throws when DB returns null', async () => {
      mockDb.createPost.mockResolvedValue(null);
      await expect(postController.createPost(makePost({ id: undefined })))
        .rejects.toThrow('Post creation failed');
    });

    it('bumps the checksum after successful creation', async () => {
      mockDb.createPost.mockResolvedValue(makePost());
      const before = postController.getPostsChecksum();
      await postController.createPost(makePost({ id: undefined }));
      expect(postController.getPostsChecksum()).not.toBe(before);
    });
  });

  describe('updatePost', () => {
    it('throws when postData is missing', async () => {
      await expect(postController.updatePost(null))
        .rejects.toThrow('Validation failed: postData missing');
    });

    it('throws when id is missing', async () => {
      await expect(postController.updatePost({ title: 'x', content: 'y', category_id: 1 }))
        .rejects.toThrow('Validation failed: id missing');
    });

    it('throws when existing post not found in DB', async () => {
      mockDb.getPostById.mockResolvedValue(null);
      await expect(postController.updatePost({ id: 99, title: 'x', content: 'y', category_id: 1 }))
        .rejects.toThrow('Validation failed: slug missing');
    });

    it('updates and returns a Post instance with preserved slug', async () => {
      const existing = makePost();
      const updated = makePost({ title: 'Updated Title' });
      mockDb.getPostById
        .mockResolvedValueOnce(existing)  // for slug lookup
        .mockResolvedValueOnce(updated);  // for post-update fetch
      mockDb.updatePost.mockResolvedValue(true);

      const result = await postController.updatePost({ id: 1, title: 'Updated Title', content: '<p>x</p>', category_id: 1 });
      expect(result).toBeInstanceOf(Post);
      expect(result.slug).toBe('test-post'); // slug preserved from existing
    });

    it('throws when DB update returns falsy', async () => {
      mockDb.getPostById.mockResolvedValue(makePost());
      mockDb.updatePost.mockResolvedValue(null);
      await expect(postController.updatePost({ id: 1, title: 'Updated Title', content: '<p>x</p>', category_id: 1 }))
        .rejects.toThrow('Post not found or not updated');
    });
  });

  describe('getAllPosts', () => {
    it('returns only published posts', async () => {
      mockDb.getAllPosts.mockResolvedValue([
        makePost({ id: 1, published: true }),
        makePost({ id: 2, slug: 'draft-post', published: false }),
      ]);
      const result = await postController.getAllPosts();
      expect(result).toHaveLength(1);
      expect(result[0].published).toBe(true);
    });

    it('returns empty array when no posts exist', async () => {
      mockDb.getAllPosts.mockResolvedValue([]);
      const result = await postController.getAllPosts();
      expect(result).toEqual([]);
    });

    it('skips posts that fail Joi validation', async () => {
      mockDb.getAllPosts.mockResolvedValue([
        makePost(),
        { id: 2, slug: '!!invalid!!', title: 'x', content: 'y', published: true, category_id: 1 },
      ]);
      const result = await postController.getAllPosts();
      expect(result).toHaveLength(1);
    });

    it('returns Post instances', async () => {
      mockDb.getAllPosts.mockResolvedValue([makePost()]);
      const result = await postController.getAllPosts();
      expect(result[0]).toBeInstanceOf(Post);
    });
  });

  describe('getMostReadPosts', () => {
    it('throws when DB returns null', async () => {
      mockDb.getMostReadPosts.mockResolvedValue(null);
      await expect(postController.getMostReadPosts())
        .rejects.toThrow(PostControllerException);
    });

    it('throws when no valid published posts exist', async () => {
      mockDb.getMostReadPosts.mockResolvedValue([makePost({ published: false })]);
      await expect(postController.getMostReadPosts())
        .rejects.toThrow('No valid published posts found');
    });

    it('returns published Post instances', async () => {
      mockDb.getMostReadPosts.mockResolvedValue([makePost({ views: 100 })]);
      const result = await postController.getMostReadPosts();
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Post);
    });
  });

  describe('deletePost', () => {
    it('returns success on deletion', async () => {
      mockDb.deletePost.mockResolvedValue(true);
      const result = await postController.deletePost(1);
      expect(result).toEqual({ success: true, message: 'Post deleted successfully' });
    });

    it('throws when post not found', async () => {
      mockDb.deletePost.mockResolvedValue(false);
      await expect(postController.deletePost(1))
        .rejects.toThrow('Post not found or not deleted');
    });

    it('bumps the checksum after deletion', async () => {
      mockDb.deletePost.mockResolvedValue(true);
      const before = postController.getPostsChecksum();
      await postController.deletePost(1);
      expect(postController.getPostsChecksum()).not.toBe(before);
    });
  });

  describe('getArchivedPosts', () => {
    it('returns empty array when no archived posts exist', async () => {
      mockDb.getArchivedPosts.mockResolvedValue([]);
      expect(await postController.getArchivedPosts()).toEqual([]);
    });

    it('filters out unpublished archived posts', async () => {
      mockDb.getArchivedPosts.mockResolvedValue([
        makePost({ published: true }),
        makePost({ id: 2, slug: 'hidden-post', published: false }),
      ]);
      const result = await postController.getArchivedPosts();
      expect(result).toHaveLength(1);
    });
  });

  describe('getPostsChecksum', () => {
    it('changes after create and delete mutations', async () => {
      mockDb.createPost.mockResolvedValue(makePost());
      const c1 = postController.getPostsChecksum();
      await postController.createPost(makePost({ id: undefined }));
      const c2 = postController.getPostsChecksum();
      expect(c2).not.toBe(c1);

      mockDb.deletePost.mockResolvedValue(true);
      await postController.deletePost(1);
      const c3 = postController.getPostsChecksum();
      expect(c3).not.toBe(c2);
    });
  });
});
