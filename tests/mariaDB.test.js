import { beforeEach, describe, expect, jest } from "@jest/globals";

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

describe("DatabaseService", () => {
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
  // it("getPostBySlug returns an exception if post not published", async () => {
  //   mockQuery.mockResolvedValueOnce([
  //       { id: 2, slug: "test", content: "tralala", published: false, views: 0, tags: "philo, wissenschaft"}
  //   ]);
  //   await expect(DatabaseService.getPostBySlug("test"))
  //   .rejects.toThrow("Error in getPostBySlug:");
  // });
  it("getPostBySlug returns multiple posts found", async () => {
    mockQuery.mockResolvedValueOnce([
        { id: 3, slug: "test", content: "tralala", published: false, views: 0, tags: "philo, wissenschaft"},
        { id: 4, slug: "test", content: "tralala", published: false, views: 0, tags: "philo, wissenschaft"}
    ]);
    await expect(DatabaseService.getPostBySlug("test"))
    .rejects.toThrow("Error in getPostBySlug:");
  });
  // it("getPostBySlug throws if not found", async () => {
  //   mockQuery.mockResolvedValueOnce([]);
  //   await expect(DatabaseService.getPostBySlug("notfound")).rejects.toThrow("Error in getPostBySlug:");
  // });
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

  it("getPostBySlug returns null if not published", async () => {
    mockQuery.mockResolvedValueOnce([
      { id: 2, slug: "test", published: false, views: 0, tags: "philo, wissenschaft"}
    ]);
    const post = await DatabaseService.getPostBySlug("test");
    expect(post).toBeNull();
  });
});

describe('PostController Tests', () => {
  it("getPostBySlug throws if post not found", async () => {
    jest.mocked(DatabaseService.getPostBySlug).mockResolvedValueOnce(null);
    await expect(postController.getPostBySlug("notfound")).rejects.toThrow("Post not found");
  });
});

