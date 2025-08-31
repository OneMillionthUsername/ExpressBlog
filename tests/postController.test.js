import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createTestScheduler } from "jest";

// JWT_SECRET für Tests setzen
process.env.JWT_SECRET = 'test_jwt_secret_key_with_at_least_32_characters_for_testing_purposes';

// DatabaseService mocken für Controller-Tests
jest.unstable_mockModule("../databases/mariaDB.js", () => ({
  DatabaseService: {
    getPostBySlug: jest.fn(),
    getAllPosts: jest.fn(),
    getPostById: jest.fn(),
    createPost: jest.fn(),
    updatePost: jest.fn(),
    getMostReadPosts: jest.fn(),
    deletePost: jest.fn(),
    getArchivedPosts: jest.fn()
  }
}));

jest.unstable_mockModule("../utils/utils.js", () => ({
  createSlug: jest.fn()
}));
const { createSlug } = await import("../utils/utils.js");

const { DatabaseService } = await import("../databases/mariaDB.js");
const postController = await import("../controllers/postController.js");

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
});

describe('PostController', () => {
  describe('getPostBySlug', () => {
    createSlug.mockReturnValue("test-post");
    it("throws if the post is not found", async () => {
      DatabaseService.getPostBySlug.mockResolvedValueOnce(null);
      await expect(postController.default.getPostBySlug("notfound"))
        .rejects.toThrow("Post not found");
    });
    it("getPostBySlug throws if the post is not published", async () => {
      // Mock: DatabaseService gibt unpublished post zurück
      DatabaseService.getPostBySlug.mockResolvedValueOnce({
        id: 1,
        slug: "test",
        published: false,
        // ... andere Felder
      });
      
      await expect(postController.default.getPostBySlug("test"))
        .rejects.toThrow("Post not found or not published");
    });
    it("getPostBySlug returns the post if it is valid", async () => {
      // Mock: DatabaseService gibt validen post zurück
      DatabaseService.getPostBySlug.mockResolvedValueOnce({
        id: 1,
        slug: "test",
        title: "Test Post",
        content: "Test content",
        published: true,
        created_at: new Date(),
        updated_at: new Date(),
        views: 10,
        tags: ["test","blog"],
        author: "Test Author"
      });
      
      const result = await postController.default.getPostBySlug("test");
      expect(result).toBeDefined();
      expect(result.slug).toBe("test");
      expect(result).toEqual({
        id: 1,
        slug: "test",
        title: "Test Post",
        content: "Test content",
        published: true,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
        views: 10,
        tags: ["test", "blog"],
        author: "Test Author"
      });
    });
    it("getPostBySlug throws if slug is invalid", async () => {
      await expect(postController.default.getPostBySlug("")).rejects.toThrow("Post not found or not published");
      await expect(postController.default.getPostBySlug("!@#$")).rejects.toThrow("Post not found or not published");
    });
    it("getPostBySlug throws if the post is deleted", async () => {
      DatabaseService.getPostBySlug.mockResolvedValueOnce({
        id: 1,
        slug: "test",
        published: false,
      });
      
      await expect(postController.default.getPostBySlug("test"))
        .rejects.toThrow("Post not found or not published");
    });
  });
  describe('createPost', () => {
    it("throws if validation fails", async () => {
      await expect(postController.default.createPost({ title: "", content: "Test content" }))
        .rejects.toThrow("Validation failed: ");
    });
    it("creates a post successfully", async () => {
      DatabaseService.createPost.mockResolvedValueOnce({
        id: 1,
        slug: createSlug("Test Post"),
        title: "Test Post",
        content: "Test content",
        published: true,
        created_at: new Date(),
        updated_at: new Date(),
        views: 0,
        tags: ["test", "blog"],
        author: "Test Author"
      });
      const result = await postController.default.createPost({
        title: "Test Post",
        slug: createSlug("Test Post"),
        content: "Test content",
        published: true,
        tags: ["test", "blog"],
        author: "Test Author"
      });
      expect(result).toBeDefined();
      expect(result.slug).toBe(createSlug(result.title));
      expect(result).toEqual({
        id: 1,
        slug: createSlug("Test Post"),
        title: "Test Post",
        content: "Test content",
        published: true,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
        views: 0,
        tags: ["test", "blog"],
        author: "Test Author"
      });
    });
    it("throws if DatabaseService.createPost fails", async () => {
      DatabaseService.createPost.mockRejectedValueOnce(new Error("Database error"));
      await expect(postController.default.createPost({
        title: "Test Post",
        slug: createSlug("Test Post"),
        content: "Test content",
        published: true,
        tags: ["test", "blog"],
        author: "Test Author"
      })).rejects.toThrow("Database error");
    });
  });
  describe('getPostById', () => {
    it("returns the post if it exists", async () => {
      DatabaseService.getPostById.mockResolvedValueOnce({
        id: 1,
        slug: createSlug("Test Post"),
        title: "Test Post",
        content: "Test content",
        published: true,
        created_at: new Date(),
        updated_at: new Date(),
        views: 10,
        tags: ["test", "blog"],
        author: "Test Author"
      });
      const result = await postController.default.getPostById(1);
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result).toEqual({
        id: 1,
        slug: createSlug("Test Post"),
        title: "Test Post",
        content: "Test content",
        published: true,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
        views: 10,
        tags: ["test", "blog"],
        author: "Test Author"
      });
    });
    it("throws if the post does not exist", async () => {
      DatabaseService.getPostById.mockResolvedValueOnce(null);
      await expect(postController.default.getPostById(1)).rejects.toThrow("Post not found");
    });
    it("throws if the post is deleted", async () => {
      DatabaseService.getPostById.mockResolvedValueOnce({
        id: 1,
        slug: createSlug("Test Post"),
        title: "Test Post",
        content: "Test content",
        published: false,
        created_at: new Date(),
        updated_at: new Date(),
        views: 10,
        tags: ["test", "blog"],
        author: "Test Author",
      });
      await expect(postController.default.getPostById(1)).rejects.toThrow("Blogpost deleted/not published");
    });
    it("throws if validation fails", async () => {
        DatabaseService.getPostById.mockResolvedValueOnce({
        id: 1,
        slug: "test-post",
        title: "", // ungültig
        content: "Test content",
        published: true,
        created_at: new Date(),
        updated_at: new Date(),
        views: 10,
        tags: ["test", "blog"],
        author: "Test Author"
      });
      await expect(postController.default.getPostById(null)).rejects.toThrow("Validation failed: ");
    });
  });
  describe('updatePost', () => {
    it("updates a post successfully", async () => {
      DatabaseService.updatePost.mockResolvedValueOnce({
        id: 1,
        slug: "updated-post",
        title: "Updated Post",
        content: "Updated content",
        published: true,
        created_at: new Date(),
        updated_at: new Date(),
        views: 0,
        tags: ["test", "blog"],
        author: "Test Author"
      });
      DatabaseService.getPostById.mockResolvedValueOnce({
        id: 1,
        slug: "updated-post",
        title: "Updated Post",
        content: "Updated content",
        published: true,
        created_at: new Date(),
        updated_at: new Date(),
        views: 0,
        tags: ["test", "blog"],
        author: "Test Author"
      });
      const result = await postController.default.updatePost({
        id: 1,
        slug: "updated-post",
        title: "Updated Post",
        content: "Updated content",
        published: true,
        tags: ["test", "blog"],
        author: "Test Author"
      });
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result).toEqual({
        id: 1,
        slug: "updated-post",
        title: "Updated Post",
        content: "Updated content",
        published: true,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
        views: 0,
        tags: ["test", "blog"],
        author: "Test Author"
      });
    });
    it("throws if the post does not exist", async () => {
      DatabaseService.updatePost.mockResolvedValueOnce(null);
      await expect(postController.default.updatePost({
        id: 1,
        slug: "updated-post",
        title: "Updated Post",
        content: "Updated content",
        published: true,
        tags: ["test", "blog"],
        author: "Test Author"
      })).rejects.toThrow("Post not found or not updated");
    });
    it("throws if validation fails", async () => {
      await expect(postController.default.updatePost({
        id: 1,
        slug: "updated-post",
        title: "",
        content: "Updated content",
        published: true,
        tags: ["test", "blog"],
        author: "Test Author"
      })).rejects.toThrow("Validation failed: ");
    });
  });
describe('getArchivedPosts', () => {
    it("returns only posts older than 3 months", async () => {
      DatabaseService.getArchivedPosts.mockResolvedValueOnce([
        {
          id: 1,
          slug: "archived-post",
          title: "Archived Post",
          content: "Archived content",
          published: true,
          created_at: new Date(Date.now() - 4 * 30 * 24 * 60 * 60 * 1000), // 4 Monate alt
          updated_at: new Date(),
          views: 0,
          tags: ["archived"],
          author: "Test Author"
        }
      ]);

      // Aufruf der Methode
      const result = await postController.default.getArchivedPosts();

      // Erwartung: Nur der ältere Post wird zurückgegeben
      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        slug: "archived-post",
        title: "Archived Post",
        content: "Archived content",
        published: true,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
        views: 0,
        tags: ["archived"],
        author: "Test Author"
      });
    });
  });
  describe('getAllPosts', () => {
    it("returns all published posts", async () => {
      DatabaseService.getAllPosts.mockResolvedValueOnce([
        {
          id: 1,
          slug: "test-post",
          title: "Test Post",
          content: "Test content",
          published: true,
          created_at: new Date(),
          updated_at: new Date(),
          views: 10,
          tags: ["test", "blog"],
          author: "Test Author"
        },
        {
          id: 2,
          slug: "draft-post",
          title: "Draft Post",
          content: "Draft content",
          published: false,
          created_at: new Date(),
          updated_at: new Date(),
          views: 5,
          tags: ["draft"],
          author: "Test Author"
        }
      ]);
      const result = await postController.default.getAllPosts();
      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        slug: "test-post",
        title: "Test Post",
        content: "Test content",
        published: true,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
        views: 10,
        tags: ["test", "blog"],
        author: "Test Author"
      });
    });
    it("throws if no posts are found", async () => {
      DatabaseService.getAllPosts.mockResolvedValueOnce([]);
      await expect(postController.default.getAllPosts()).rejects.toThrow("No valid published posts found");
    });
  });
  describe('getMostReadPosts', () => {
    it("returns the most read posts", async () => {
      DatabaseService.getMostReadPosts.mockResolvedValueOnce([
        {
          id: 1,
          slug: "most-read-post",
          title: "Most Read Post",
          content: "Most read content",
          published: true,
          created_at: new Date(),
          updated_at: new Date(),
          views: 100,
          tags: ["most-read"],
          author: "Test Author"
        }
      ]);
      const result = await postController.default.getMostReadPosts();
      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        slug: "most-read-post",
        title: "Most Read Post",
        content: "Most read content",
        published: true,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
        views: 100,
        tags: ["most-read"],
        author: "Test Author"
      });
    });
    it("throws if no posts are found", async () => {
      DatabaseService.getMostReadPosts.mockResolvedValueOnce([]);
      await expect(postController.default.getMostReadPosts()).rejects.toThrow("No valid published posts found");
    });
  });
  describe('deletePost', () => {
    it("deletes a post", async () => {
      DatabaseService.deletePost.mockResolvedValueOnce(true);
      const result = await postController.default.deletePost(1);
      expect(result).toEqual({ success: true, message: 'Post deleted successfully' });
    });
    it("throws if the post does not exist", async () => {
      DatabaseService.deletePost.mockResolvedValueOnce(false);
      await expect(postController.default.deletePost(1)).rejects.toThrow("Post not found or not deleted");
    });
  });
});