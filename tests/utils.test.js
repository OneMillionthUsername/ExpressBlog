//Contains unit and integration tests to ensure that the application works as expected.

/**
- Integration.js: Integration tests for testing multiple components together.
- unit.js: Unit tests for individual components or functions.
 */
// INTEGRATION TESTS
// import DatabaseService from '../DatabaseService.js';

// jest.mock('../DatabaseService.js', () => ({
//   getPostBySlug: jest.fn(),
//   incrementViews: jest.fn(),
// }));

// let post = { id: 1,
//     title: "Unit test",
//     slug: "unit-test",
//     content: "lorem ipsum dolor",
//     tags: ["Philosophie", "Wissenschaft"],
//     author: "admin",
//     views: 12 };

// test('getPostBySlug returns mocked post', () => {
//   DatabaseService.getPostBySlug.mockReturnValue({ title: 'Unit test' });
//   const post = DatabaseService.getPostBySlug('unit-test');
//   expect(post.title).toBe('unit-test');
// });

// UNIT TESTS
import { jest } from '@jest/globals';

jest.unstable_mockModule('../utils/utils.js', () => ({
  escapeAllStrings: jest.fn((input) => input),
  sanitizeFilename: jest.fn((filename) => 'safe_' + filename)
}));

import { createEscapeInputMiddleware } from '../utils/middleware.js';
import { escapeAllStrings, sanitizeFilename } from '../utils/utils.js';

describe('creatEscapeInputMiddleware', () => {
  it('should escape body, query, params, cookies, headers and file names', () => {
    const whitelist = ['content'];
    const req = {
      body: {content: '<b>test</b>'},
      query: {q: '<script>'},
      params: {id: '<img>'},
      cookies: {session: '<cookie>'},
      headers: { 'user-agent': '<us>', referer: '<ref>'},
      file: { originalname: 'file.txt'},
      files: [{ originalname: 'file1.txt'}, {originalname: 'file2.txt'}]
    };
    const res = {};
    const next = jest.fn();

    const middleware = createEscapeInputMiddleware(whitelist);
    middleware(req, res, next);

    expect(req.body.content).toBe('<b>test</b>');
    expect(req.query.q).toBe('&lt;script&gt;');
    expect(req.file.safeFilename).toBe('safe_file.txt');
    expect(req.files[0].safeFilename).toBe('safe_file1.txt');
    expect(req.files[1].safeFilename).toBe('safe_file2.txt');
    expect(next).toHaveBeenCalled(1);
    // Prüfen, ob `escapeAllstrings` für jedes Feld aufgerufen wurde, das nicht in der Whitelist steht
    expect(escapeAllStrings).toHaveBeenCalledWith(req.query.q);
    expect(escapeAllStrings).toHaveBeenCalledWith(req.params.id);
  });


});
