import simpleCache from '../utils/simpleCache.js';

describe('simpleCache freezing', () => {
  test('cached object is frozen and cannot be mutated', () => {
    const key = 'test:post';
    const original = { id: 1, title: 'X', content: '<p>Hello</p>' };
    simpleCache.set(key, original, 1000);
    const cached = simpleCache.get(key);
    // Content should be preserved as-is
    expect(cached.content).toBe('<p>Hello</p>');
    // Object should be frozen — mutation throws in strict mode
    expect(Object.isFrozen(cached)).toBe(true);
    expect(() => { cached.title = 'Changed'; }).toThrow();
    // Cache still returns original value
    const cached2 = simpleCache.get(key);
    expect(cached2.title).toBe('X');
    simpleCache.del(key);
  });
});
