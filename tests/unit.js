//Contains unit and integration tests to ensure that the application works as expected.

/**
- Integration.js: Integration tests for testing multiple components together.
- unit.js: Unit tests for individual components or functions.
 */

import DatabaseService from '../DatabaseService.js';

jest.mock('../DatabaseService.js', () => ({
  getPostBySlug: jest.fn(),
  incrementViews: jest.fn(),
}));

let post = { id: 1,
    title: "Unit test",
    slug: "unit-test",
    content: "lorem ipsum dolor",
    tags: ["Philosophie", "Wissenschaft"],
    author: "admin",
    views: 12 };

test('getPostBySlug returns mocked post', () => {
  DatabaseService.getPostBySlug.mockReturnValue({ title: 'Unit test' });
  const post = DatabaseService.getPostBySlug('unit-test');
  expect(post.title).toBe('unit-test');
});

// UNIT TESTS


