import simpleCache from '../utils/simpleCache.js';

describe('simpleCache sanitization and cloning', () => {
  test('cached object is deep-cloned on get and content sanitized', () => {
    const key = 'test:post';
    const original = { id: 1, title: 'X', content: '<script>alert(1)</script><p>Hello</p>' };
    simpleCache.set(key, original, 1000);
    const cached = simpleCache.get(key);
    // Should not be the same reference
    expect(cached).not.toBe(original);
    // Content should have script removed (sanitization attempted)
    expect(String(cached.content)).not.toContain('<script>');
    // Modifying returned object should not affect cache
    cached.title = 'Changed';
    const cached2 = simpleCache.get(key);
    expect(cached2.title).toBe('X');
    simpleCache.del(key);
  });
});
