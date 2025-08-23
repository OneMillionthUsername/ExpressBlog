import { beforeEach, describe, expect, jest } from "@jest/globals";

// JWT_SECRET für Tests setzen
process.env.JWT_SECRET = 'test_jwt_secret_key_with_at_least_32_characters_for_testing_purposes';

// DatabaseService mocken für Controller-Tests
jest.unstable_mockModule("../databases/mariaDB.js", () => ({
  DatabaseService: {
    getPostBySlug: jest.fn(),
    getAllPosts: jest.fn(),
    getPostById: jest.fn()
  }
}));

const { DatabaseService } = await import("../databases/mariaDB.js");
const postController = await import("../controllers/postController.js");

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
});

describe('PostController Tests', () => {
  it("getPostBySlug throws if the post is not found", async () => {
    // DatabaseService soll null zurückgeben
    DatabaseService.getPostBySlug.mockResolvedValueOnce(null);
    
    // Controller soll Exception werfen
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