/** @jest-environment node */
import { describe, expect, it, jest } from '@jest/globals';

// Mock mariaDB to avoid DB connection at import time (only needed for incrementViews)
jest.unstable_mockModule('../databases/mariaDB.js', () => ({
  DatabaseService: { increasePostViews: jest.fn() },
}));
jest.unstable_mockModule('./sanitizer.js', () => ({
  sanitizeHtml: jest.fn((s) => s),
}));

const {
  escapeHtml,
  unescapeHtml,
  escapeAllStrings,
  createSlug,
  truncateSlug,
  convertBigInts,
  parseTags,
  sanitizeFilename,
} = await import('../utils/utils.js');

describe('escapeHtml', () => {
  it('escapes all five HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(escapeHtml("it's & that")).toBe('it&#39;s &amp; that');
  });

  it('returns non-strings unchanged', () => {
    expect(escapeHtml(42)).toBe(42);
    expect(escapeHtml(null)).toBe(null);
    expect(escapeHtml(undefined)).toBe(undefined);
  });

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('unescapeHtml', () => {
  it('reverses all five HTML entities', () => {
    expect(unescapeHtml('&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;'))
      .toBe('<b>&"\'</b>');
  });

  it('handles &amp; last to avoid double-decoding', () => {
    // &amp;lt; should become &lt; (not <)
    expect(unescapeHtml('&amp;lt;')).toBe('&lt;');
  });

  it('returns non-strings unchanged', () => {
    expect(unescapeHtml(42)).toBe(42);
  });
});

describe('escapeAllStrings', () => {
  it('escapes strings in a flat object', () => {
    const result = escapeAllStrings({ name: '<b>test</b>', count: 5 });
    expect(result.name).toBe('&lt;b&gt;test&lt;/b&gt;');
    expect(result.count).toBe(5);
  });

  it('escapes strings in nested objects', () => {
    const result = escapeAllStrings({ a: { b: '<x>' } });
    expect(result.a.b).toBe('&lt;x&gt;');
  });

  it('escapes strings in arrays', () => {
    const result = escapeAllStrings(['<a>', '<b>']);
    expect(result).toEqual(['&lt;a&gt;', '&lt;b&gt;']);
  });

  it('skips whitelisted keys (passes through via domPurifyInstance mock)', () => {
    const mockPurify = { sanitize: jest.fn((s) => `SANITIZED:${s}`) };
    const result = escapeAllStrings({ content: '<p>hello</p>' }, ['content'], [], mockPurify);
    expect(mockPurify.sanitize).toHaveBeenCalled();
    expect(result.content).toBe('SANITIZED:<p>hello</p>');
  });

  it('throws on prototype-polluting keys', () => {
    expect(() => escapeAllStrings({ __proto__: 'evil' })).toThrow('Forbidden key detected');
    expect(() => escapeAllStrings({ constructor: 'evil' })).toThrow('Forbidden key detected');
  });

  it('returns null and undefined unchanged', () => {
    expect(escapeAllStrings(null)).toBeNull();
    expect(escapeAllStrings(undefined)).toBeUndefined();
  });
});

describe('createSlug', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(createSlug('Hello World')).toBe('hello-world');
  });

  it('converts German umlauts', () => {
    expect(createSlug('Müller & Söhne GmbH')).toBe('mueller-soehne-gmbh');
    expect(createSlug('Straße und Übung')).toBe('strasse-und-uebung');
  });

  it('collapses multiple hyphens', () => {
    expect(createSlug('Test   Multiple   Spaces')).toBe('test-multiple-spaces');
  });

  it('removes leading and trailing hyphens', () => {
    expect(createSlug('  hello world  ')).toBe('hello-world');
  });

  it('truncates at maxLength (default 50) on a word boundary', () => {
    const long = 'this is a very long title that exceeds fifty chars exactly here';
    const result = createSlug(long);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result).not.toMatch(/-$/);
  });

  it('returns empty string for falsy input', () => {
    expect(createSlug('')).toBe('');
    expect(createSlug(null)).toBe('');
  });
});

describe('truncateSlug', () => {
  it('returns slug unchanged when within limit', () => {
    expect(truncateSlug('hello-world', 50)).toBe('hello-world');
  });

  it('truncates at the last hyphen to avoid mid-word cut', () => {
    expect(truncateSlug('hello-world-foo', 12)).toBe('hello-world');
  });

  it('hard-truncates when no hyphen found within limit', () => {
    expect(truncateSlug('helloworld', 5)).toBe('hello');
  });
});

describe('convertBigInts', () => {
  it('converts safe BigInt to Number', () => {
    expect(convertBigInts(BigInt(42))).toBe(42);
  });

  it('returns NaN for BigInt exceeding MAX_SAFE_INTEGER', () => {
    expect(convertBigInts(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toBeNaN();
  });

  it('converts BigInt fields in objects', () => {
    const obj = { id: BigInt(7), name: 'test' };
    const result = convertBigInts(obj);
    expect(result.id).toBe(7);
    expect(result.name).toBe('test');
  });

  it('converts BigInt elements in arrays', () => {
    expect(convertBigInts([BigInt(1), BigInt(2)])).toEqual([1, 2]);
  });

  it('leaves numbers and strings unchanged', () => {
    expect(convertBigInts(42)).toBe(42);
    expect(convertBigInts('hello')).toBe('hello');
  });
});

describe('parseTags', () => {
  it('returns arrays unchanged', () => {
    expect(parseTags(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('parses JSON string of array', () => {
    expect(parseTags('["foo","bar"]')).toEqual(['foo', 'bar']);
  });

  it('parses comma-separated string', () => {
    expect(parseTags('foo, bar, baz')).toEqual(['foo', 'bar', 'baz']);
  });

  it('returns empty array for null or undefined', () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseTags('')).toEqual([]);
  });
});

describe('sanitizeFilename', () => {
  it('removes path traversal', () => {
    // path.basename strips directory components
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
  });

  it('replaces forbidden characters with underscore', () => {
    expect(sanitizeFilename('file<name>.txt')).toBe('file_name_.txt');
    expect(sanitizeFilename('my file name.txt')).toBe('my_file_name.txt');
  });

  it('preserves alphanumeric, dot, dash, underscore', () => {
    expect(sanitizeFilename('normal-file_v2.txt')).toBe('normal-file_v2.txt');
  });

  it('truncates to 255 characters', () => {
    const long = 'a'.repeat(300) + '.txt';
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(255);
  });
});
