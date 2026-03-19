import simpleCache from '../utils/simpleCache.js';

describe('simpleCache cloning', () => {
  test('cached object is deep-cloned on get', () => {
    const key = 'test:post';
    const original = { id: 1, title: 'X', content: '<p>Hello</p>' };
    simpleCache.set(key, original, 1000);
    const cached = simpleCache.get(key);
    // Should not be the same reference
    expect(cached).not.toBe(original);
    // Content should be preserved as-is (sanitization is not the cache's job)
    expect(cached.content).toBe('<p>Hello</p>');
    // Modifying returned object should not affect cache
    cached.title = 'Changed';
    const cached2 = simpleCache.get(key);
    expect(cached2.title).toBe('X');
    simpleCache.del(key);
  });
});
