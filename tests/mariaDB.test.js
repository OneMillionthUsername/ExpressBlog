import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";

// Pool und Connection mocken
const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockGetConnection = jest.fn(() => Promise.resolve({
  query: mockQuery,
  release: mockRelease,
}));

// Mariadb-Modul mocken
jest.unstable_mockModule("mariadb", () => ({
  createPool: () => ({
    getConnection: mockGetConnection,
  }),
}));

jest.unstable_mockModule("../controllers/postController.js", () => ({
  default: {
    getPostBySlug: jest.fn()
  }
}));


// Jetzt erst das zu testende Modul importieren!
const { DatabaseService } = await import("../databases/mariaDB.js");
const postController = await import("../controllers/postController.js");

beforeEach(() => {
  mockQuery.mockReset();
  mockRelease.mockReset();
  mockGetConnection.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
});

describe("DatabaseService", () => {
  describe('getPostBySlug', () => {
    it("getPostBySlug returns post if found and published", async () => {
        mockQuery.mockResolvedValueOnce([
          { id: 1, slug: "test", published: true, views: 10, tags: "foo,bar" }
        ]);
        const post = await DatabaseService.getPostBySlug("test");
      expect(post.slug).toBe("test");
      expect(post.views).toBe(10);
      expect(mockGetConnection).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });
    it("getPostBySlug returns multiple posts found", async () => {
      mockQuery.mockResolvedValueOnce([
          { id: 3, slug: "test", content: "tralala", published: false, views: 0, tags: "philo, wissenschaft"},
          { id: 4, slug: "test", content: "tralala", published: false, views: 0, tags: "philo, wissenschaft"}
      ]);
      const post = await DatabaseService.getPostBySlug("test");
      expect(post).toBeNull();
    });
    it("getPostBySlug throws if slug is invalid", async () => {
      const post = await DatabaseService.getPostBySlug("");
      expect(post).toBeNull();
      const postTwo = await DatabaseService.getPostBySlug("!@#$");
      expect(postTwo).toBeNull();
    });
    it("getPostBySlug returns null if deleted or not published", async () => {
      mockQuery.mockResolvedValueOnce([
        { id: 2, slug: "test", published: false, views: 0, tags: "philo, wissenschaft"}
      ]);
      const post = await DatabaseService.getPostBySlug("test");
      expect(post).toBeNull();
    });
    it("getPostBySlug throws if query fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.getPostBySlug("test")).rejects.toThrow("Error in getPostBySlug: DB error");
    });
  });
  describe('getAllPosts', () => {
    it("getAllPosts returns a json of all posts", async () => {
      mockQuery.mockResolvedValueOnce([
          { id: 3, slug: "test", content: "tralala", published: true, views: 10, tags: "philo, wissenschaft"},
          { id: 4, slug: "best", content: "trululu", published: false, views: 120, tags: "kilo, bissenschaft, kunst"},
          { id: 5, slug: "rest", content: "trelele", published: true, views: 220, tags: "milo, gissenschaft"},
          { id: 6, slug: "lest", published: true, views: 220, tags: ""},
          { id: 7, slug: "zest", published: true, views: 220, tags: ""},
      ]);
      const posts = await DatabaseService.getAllPosts();
      expect(posts).toBeDefined();
      expect(posts.length).toEqual(5);
      posts.forEach(p => {expect(typeof p.id).not.toBe('bigint');});
      expect(posts[0].tags).toEqual(["philo", "wissenschaft"]);
      expect(posts[1].tags).toEqual(["kilo", "bissenschaft", "kunst"]);
    });
    it("getAllPosts return no posts found", async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(DatabaseService.getAllPosts()).rejects.toThrow("Error in getAllPosts:");
    });
    it("getAllPosts throws if query fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.getAllPosts()).rejects.toThrow("Error in getAllPosts: DB error");
    });
    it("getAllPosts throws if query fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.getAllPosts()).rejects.toThrow("Error in getAllPosts: DB error");
    });
  });
  describe('getPostById', () => {
    it('getPostById returns post if found', async () => {
      mockQuery.mockResolvedValueOnce([
        { id: 1, slug: "test", published: true, views: 10, tags: "foo,bar" }
      ]);
      const post = await DatabaseService.getPostById(1);
      expect(post.slug).toBe("test");
      expect(post.views).toBe(10);
      expect(mockGetConnection).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });
    it('getPostById returns null if not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(DatabaseService.getPostById(999)).rejects.toThrow("Error in getPostById: Post not found");
    });
    it('getPostById throws if query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.getPostById(1)).rejects.toThrow("Error in getPostById: DB error");
    });
    it('getPostById returns post if id and views are bigInt', async () => {
      mockQuery.mockResolvedValueOnce([
        { id: BigInt(1), slug: "test", published: true, views: BigInt(10), tags: "foo,bar" }
      ]);
      const post = await DatabaseService.getPostById(BigInt(1));
      expect(post.slug).toBe("test");
      expect(post.id).toBe(1);
      expect(post.views).toBe(10);
      expect(mockGetConnection).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });
  });
  describe('getMostReadPosts', () => {
    it('getMostReadPosts returns top N posts', async () => {
      const topN = 5;
      mockQuery.mockResolvedValueOnce([
        { id: 1, slug: "test", published: true, views: 100, tags: "foo,bar" },
        { id: 2, slug: "best", published: true, views: 200, tags: "baz,qux" },
        { id: 3, slug: "rest", published: true, views: 300, tags: "quux,corge" },
        { id: 4, slug: "lest", published: true, views: 400, tags: "grault,garply" },
        { id: 5, slug: "zest", published: true, views: 500, tags: "waldo,fred" },
      ]);
      const posts = await DatabaseService.getMostReadPosts(topN);
      expect(posts).toBeDefined();
      expect(posts.length).toEqual(topN);
      posts.forEach(p => { expect(typeof p.id).not.toBe('bigint'); });
    });
    it('getMostReadPosts throws if no posts found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(DatabaseService.getMostReadPosts(5)).rejects.toThrow("Error in getMostReadPosts: No posts found");
    });
    it('getMostReadPosts throws if query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.getMostReadPosts(5)).rejects.toThrow("Error in getMostReadPosts: DB error");
    });
  });
  describe('increasePostViews', () => {
    it('increasePostViews increments views without errors', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
      await expect(DatabaseService.increasePostViews(1, '192.168.1.1')).resolves.not.toThrow();
    });
    it('increasePostViews throws if query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.increasePostViews(1, '192.168.1.1')).rejects.toThrow("Error in increasePostViews: DB error");
    });
    it('increasePostViews throws if no rows affected', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
      await expect(DatabaseService.increasePostViews(999, '192.168.1.1')).rejects.toThrow("Error in increasePostViews: No rows affected");
  });
  });
  describe('updatePost', () => {
    it('updatePost updates post without errors', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
      await expect(DatabaseService.updatePost({ id: 1, title: 'Updated Title', content: 'Updated Content' })).resolves.not.toThrow();
    });
    it('updatePost throws if query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.updatePost({ id: 1, title: 'Updated Title' })).rejects.toThrow("Error in updatePost: DB error");
    });
    it('updatePost throws if no rows affected', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
      await expect(DatabaseService.updatePost({ id: 999, title: 'Updated Title' })).rejects.toThrow("Error in updatePost: Failed to update post");
    });
    it('updatePost throws if no fields to update', async () => {
      await expect(DatabaseService.updatePost({ id: 1 })).rejects.toThrow("Error in updatePost: No fields provided for update");
    });
    it('updatePost throws if post is null', async () => {
      await expect(DatabaseService.updatePost(null)).rejects.toThrow("Error in updatePost: Post is null");
    });
    it('updatePost throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.updatePost({ id: 1, title: 'Updated Title' })).rejects.toThrow("Error in updatePost: DB error");
    });
  });
  describe('deletePost', () => {
    it('deletePost deletes post without errors', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
      await expect(DatabaseService.deletePost(1)).resolves.not.toThrow();
    });
    it('deletePost throws if no rows affected', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
      await expect(DatabaseService.deletePost(999)).rejects.toThrow("Error in deletePost: Failed to delete post");
    });
    it('deletePost throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.deletePost(1)).rejects.toThrow("Error in deletePost: DB error");
    });
  });
  describe('createPost', () => {
    it('createPost creates post without errors', async () => {
      mockQuery.mockResolvedValueOnce({ insertId: 1 });
      await expect(DatabaseService.createPost({ title: 'New Post', content: 'Post Content' })).resolves.not.toThrow();
    });
    it('createPost throws if no data provided', async () => {
      await expect(DatabaseService.createPost(null)).rejects.toThrow("Error in createPost: Post is null or invalid");
    });
    it('createPost throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.createPost({ title: 'New Post', content: 'Post Content' })).rejects.toThrow("Error in createPost: DB error");
    });
  });
  // Cards
  describe('createCard', () => {
    it('createCard creates card without errors', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1, insertId: 1 });
      await expect(DatabaseService.createCard({ title: 'New Card', content: 'Card Content' })).resolves.not.toThrow();
    });
    it('createCard returns success and card object', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1, insertId: 1 });
      const cardData = {
        title: 'Test Card',
        subtitle: 'Test Subtitle',
        link: 'https://example.com',
        img: '/images/test.png',
        published: 1
      };
      const result = await DatabaseService.createCard(cardData);
    
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.card).toBeDefined();
      expect(result.card.title).toBe(cardData.title);
      expect(result.card.id).toBeGreaterThan(0);
      expect(result.card.link).toBe(cardData.link);
      expect(result.card.img).toBe(cardData.img);
      expect(result.card.published).toBe(cardData.published);
    });
    it('createCard throws if no data provided', async () => {
      await expect(DatabaseService.createCard(null)).rejects.toThrow("Error in createCard: Card is null or invalid");
    });
    it('createCard throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.createCard({ title: 'New Card', content: 'Card Content' })).rejects.toThrow("Error in createCard: DB error");
    });
    it('createCard throws if no rows affected', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
      await expect(DatabaseService.createCard({ title: 'New Card', content: 'Card Content' })).rejects.toThrow("Error in createCard: No rows affected");
    });
  });
  describe('getAllCards', () => {
    it('getAllCards returns all cards without errors', async () => {
      mockQuery.mockResolvedValueOnce([{ id: 1, title: 'Test Card' }]);
      await expect(DatabaseService.getAllCards()).resolves.not.toThrow();
    });
    it('getAllCards throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.getAllCards()).rejects.toThrow("Error in getAllCards: DB error");
    });
    it('getAllCards throws if no cards found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(DatabaseService.getAllCards()).rejects.toThrow("Error in getAllCards: No cards found");
    });
  });
  describe('getCardById', () => {
    it('getCardById returns card without errors', async () => {
      mockQuery.mockResolvedValueOnce([{ id: 1, title: 'Test Card' }]);
      await expect(DatabaseService.getCardById(1)).resolves.not.toThrow();
    });
    it('getCardById throws if no ID provided', async () => {
      await expect(DatabaseService.getCardById(null)).rejects.toThrow("Error in getCardById: ID is null or invalid");
    });
    it('getCardById throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.getCardById(1)).rejects.toThrow("Error in getCardById: DB error");
    });
    it('getCardById returns null if no card found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(DatabaseService.getCardById(999)).resolves.toBeNull();
    });
  });
  describe('deleteCard', () => {
    it('deleteCard deletes card without errors', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
      await expect(DatabaseService.deleteCard(1)).resolves.not.toThrow();
    });
    it('deleteCard throws if no ID provided', async () => {
      await expect(DatabaseService.deleteCard(null)).rejects.toThrow("Error in deleteCard: ID is null or invalid");
    });
    it('deleteCard throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.deleteCard(1)).rejects.toThrow("Error in deleteCard: DB error");
    });
    it('deleteCard throws if no rows affected', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
      await expect(DatabaseService.deleteCard(1)).rejects.toThrow("Error in deleteCard: No rows affected");
    });
  });
  // Comments
  describe('createComment', () => {
    it('createComment creates comment without errors', async () => {
      mockQuery.mockResolvedValueOnce({ insertId: 1 });
      await expect(DatabaseService.createComment(1, { text: 'New Comment' })).resolves.not.toThrow();
    });
    it('createComment throws if no data provided', async () => {
      await expect(DatabaseService.createComment(1, null)).rejects.toThrow("Error in createComment: Comment data is null or invalid");
    });
    it('createComment throws if no postId provided', async () => {
      await expect(DatabaseService.createComment(null, { text: 'New Comment' })).rejects.toThrow("Error in createComment: Post ID is null or invalid");
    });
    it('createComment throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.createComment(1, { text: 'New Comment' })).rejects.toThrow("Error in createComment: DB error");
    });
    it('createComment returns success and comment object', async () => {
      mockQuery.mockResolvedValueOnce({ insertId: 1 });
      const commentData = { text: 'New Comment' };
      await expect(DatabaseService.createComment(1, commentData)).resolves.toEqual(
        { success: true, comment: { id: 1, postId: 1, text: 'New Comment' } }
      );
    });
  });
  describe('getCommentsByPostId', () => {
    it('getCommentsByPostId returns comments for a post', async () => {
      mockQuery.mockResolvedValueOnce([{ id: 1, text: 'Comment 1', created_at: new Date('2023-01-01'), username: 'user1' }]);
      await expect(DatabaseService.getCommentsByPostId(1)).resolves.toEqual([
        { id: 1, text: 'Comment 1', created_at: new Date('2023-01-01'), username: 'user1' }
      ]);
    });
    it('getCommentsByPostId throws if no postId provided', async () => {
      await expect(DatabaseService.getCommentsByPostId(null)).rejects.toThrow("Error in getCommentsByPostId: Post ID is null or invalid");
    });
    it('getCommentsByPostId throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.getCommentsByPostId(1)).rejects.toThrow("Error in getCommentsByPostId: DB error");
    });
  });
  describe('deleteComment', () => {
    it('deleteComment deletes comment without errors', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
      await expect(DatabaseService.deleteComment(1)).resolves.not.toThrow();
    });
    it('deleteComment throws if no ID provided', async () => {
      await expect(DatabaseService.deleteComment(null)).rejects.toThrow("Error in deleteComment: Comment ID is null or invalid");
    });
    it('deleteComment throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.deleteComment(1)).rejects.toThrow("Error in deleteComment: DB error");
    });
    it('deleteComment throws if no rows affected', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
      await expect(DatabaseService.deleteComment(1)).resolves.toBeNull();
    });
  });
  // Media
  describe('addMedia', () => {
    it('addMedia creates media without errors', async () => {
      mockQuery.mockResolvedValueOnce({ insertId: 1 });
      await expect(DatabaseService.addMedia({ postId: 1, original_name: 'image.jpg' })).resolves.not.toThrow();
    });
    it('addMedia throws if no data provided', async () => {
      await expect(DatabaseService.addMedia(null)).rejects.toThrow("Error in addMedia: Media data is null or invalid");
    });
    it('addMedia throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.addMedia({ postId: 1, original_name: 'image.jpg' })).rejects.toThrow("Error in addMedia: DB error");
    });
  });
  describe('deleteMedia', () => {
    it('deleteMedia deletes media without errors', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
      await expect(DatabaseService.deleteMedia(1)).resolves.not.toThrow();
    });
    it('deleteMedia throws if no ID provided', async () => {
      await expect(DatabaseService.deleteMedia(null)).rejects.toThrow("Error in deleteMedia: Media ID is null or invalid");
    });
    it('deleteMedia throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.deleteMedia(1)).rejects.toThrow("Error in deleteMedia: DB error");
    });
    it('deleteMedia throws if no rows affected', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
      await expect(DatabaseService.deleteMedia(1)).resolves.toBeNull();
    });
  });
  describe('getMediaById', () => {
    it('getMediaById returns media without errors', async () => {
      mockQuery.mockResolvedValueOnce([{ id: 1, original_name: 'image.jpg' }]);
      await expect(DatabaseService.getMediaById(1)).resolves.not.toThrow();
    });
    it('getMediaById throws if no ID provided', async () => {
      await expect(DatabaseService.getMediaById(null)).rejects.toThrow("Error in getMediaById: Media ID is null or invalid");
    });
    it('getMediaById throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.getMediaById(1)).rejects.toThrow("Error in getMediaById: DB error");
    });
  });
  // Admin
  describe('getAdminByUsername', () => {
    it('getAdminByUsername returns admin without errors', async () => {
      mockQuery.mockResolvedValueOnce([{ id: 1, username: 'admin' }]);
      await expect(DatabaseService.getAdminByUsername('admin')).resolves.not.toThrow();
    });
    it('getAdminByUsername throws if no username provided', async () => {
      await expect(DatabaseService.getAdminByUsername(null)).rejects.toThrow("Error in getAdminByUsername: Username is null or invalid");
    });
    it('getAdminByUsername throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.getAdminByUsername('admin')).rejects.toThrow("Error in getAdminByUsername: DB error");
    });
  });
  describe('updateAdminLoginSuccess', () => {
    it('updateAdminLoginSuccess updates admin without errors', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
      await expect(DatabaseService.updateAdminLoginSuccess(1)).resolves.not.toThrow();
    });
    it('updateAdminLoginSuccess returns false if no rows affected', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
      await expect(DatabaseService.updateAdminLoginSuccess(1)).resolves.toBe(false);
    });
    it('updateAdminLoginSuccess throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.updateAdminLoginSuccess(1)).rejects.toThrow("Error in updateAdminLoginSuccess: DB error");
    });
  });
  describe('updateAdminLoginFailure', () => {
    it('updateAdminLoginFailure updates admin without errors', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
      await expect(DatabaseService.updateAdminLoginFailure(1)).resolves.not.toThrow();
    });
    it('updateAdminLoginFailure returns false if no rows affected', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
      await expect(DatabaseService.updateAdminLoginFailure(1)).resolves.toBe(false);
    });
    it('updateAdminLoginFailure throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.updateAdminLoginFailure(1)).rejects.toThrow("Error in updateAdminLoginFailure: DB error");
    });
    it('updateAdminLoginFailure throws if no ID provided', async () => {
      await expect(DatabaseService.updateAdminLoginFailure(null)).rejects.toThrow("Error in updateAdminLoginFailure: Admin ID is null or invalid");
    });
    it('updateAdminLoginFailure sets locked_until after 3 failed attempts', async () => {
      mockQuery
        .mockResolvedValueOnce([{ login_attempts: 2 }])
        .mockResolvedValueOnce({ affectedRows: 1 }); 
    
      const adminId = 1;
      const result = await DatabaseService.updateAdminLoginFailure(adminId);
    
      expect(result).toBe(true);
    
      const updateArgs = mockQuery.mock.calls[1][1];
      const currentAttempts = updateArgs[0];         
      const lockedUntil = updateArgs[1];             
    
      expect(currentAttempts).toBe(3);
      expect(lockedUntil).toBeInstanceOf(Date);
      expect(lockedUntil.getTime()).toBeGreaterThan(Date.now());
    });
  });
  describe('updateAdminStatus', () => {
    it('updateAdminStatus updates admin without errors', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
      await expect(DatabaseService.updateAdminStatus(1, 'active')).resolves.not.toThrow();
    });
    it('updateAdminStatus returns false if no rows affected', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
      await expect(DatabaseService.updateAdminStatus(1, 'active')).resolves.toBe(false);
    });
    it('updateAdminStatus throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.updateAdminStatus(1, 'active')).rejects.toThrow("Error in updateAdminStatus: DB error");
    });
  });
});