import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

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
      await expect(DatabaseService.updatePost(1, { title: 'Updated Title', content: 'Updated Content' })).resolves.not.toThrow();
    });
    it('updatePost throws if query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.updatePost(1, { title: 'Updated Title' })).rejects.toThrow("Error in updatePost: DB error");
    });
    it('updatePost throws if no rows affected', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
      await expect(DatabaseService.updatePost(999, { title: 'Updated Title' })).rejects.toThrow("Error in updatePost: Failed to update post");
    });
    it('updatePost throws if no fields to update', async () => {
      await expect(DatabaseService.updatePost(1, {})).rejects.toThrow("Error in updatePost: No fields provided for update");
    });
    it('updatePost throws if post is null', async () => {
      await expect(DatabaseService.updatePost(1, null)).rejects.toThrow("Error in updatePost: Post is null");
    });
    it('updatePost throws if DB error occurs', async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));
      await expect(DatabaseService.updatePost(1, { title: 'Updated Title' })).rejects.toThrow("Error in updatePost: DB error");
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
});