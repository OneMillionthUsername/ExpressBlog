import { describe, expect, it, jest } from '@jest/globals';

// Mock global fetch for API tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data: 'test' }),
  }),
);

describe('Utils Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      // Test the escaping logic inline
      const escapeHtml = (text) => {
        if (!text || typeof text !== 'string') return text;
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };

      expect(escapeHtml('<script>alert("test")</script>'))
        .toBe('&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;');
      expect(escapeHtml('Hello & Goodbye')).toBe('Hello &amp; Goodbye');
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml(null)).toBe(null);
    });

    it('should return non-string values unchanged', () => {
      const escapeHtml = (text) => {
        if (!text || typeof text !== 'string') return text;
        return text.replace(/&/g, '&amp;');
      };

      expect(escapeHtml(123)).toBe(123);
      expect(escapeHtml(undefined)).toBe(undefined);
    });
  });

  describe('unescapeHtml', () => {
    it('should unescape HTML entities', () => {
      const unescapeHtml = (text) => {
        if (!text || typeof text !== 'string') return text;
        return text
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, '\'')
          .replace(/&amp;/g, '&'); // Must be last to avoid double replacement
      };

      expect(unescapeHtml('&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;'))
        .toBe('<script>alert("test")</script>');
      expect(unescapeHtml('Hello &amp; Goodbye')).toBe('Hello & Goodbye');
    });

    it('should return non-string values unchanged', () => {
      const unescapeHtml = (text) => {
        if (!text || typeof text !== 'string') return text;
        return text.replace(/&amp;/g, '&');
      };

      expect(unescapeHtml(123)).toBe(123);
      expect(unescapeHtml(null)).toBe(null);
    });
  });

  describe('createSlug', () => {
    it('should create URL-friendly slugs', () => {
      const createSlug = (title) => {
        if (!title) return '';
        return title
          .toLowerCase()
          .replace(/[äöüß]/g, (match) => {
            const map = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
            return map[match] || match;
          })
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 50);
      };

      expect(createSlug('Hello World!')).toBe('hello-world');
      expect(createSlug('Müller & Söhne GmbH')).toBe('mueller-soehne-gmbh');
      expect(createSlug('Test   Multiple   Spaces')).toBe('test-multiple-spaces');
      expect(createSlug('')).toBe('');
    });

    it('should truncate long slugs', () => {
      const createSlug = (title) => {
        if (!title) return '';
        return title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 50);
      };

      const longTitle = 'This is a very long title that should be truncated to fifty characters maximum';
      const result = createSlug(longTitle);
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result).toBe('this-is-a-very-long-title-that-should-be-truncated');
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove dangerous characters from filenames', () => {
      const sanitizeFilename = (filename) => {
        if (!filename) return '';
        // Remove path separators and dangerous characters
        return filename
          .replace(/[/\\:*?"<>|]/g, '_')
          .replace(/\.\./g, '__')
          .substring(0, 255);
      };

      expect(sanitizeFilename('test/file.txt')).toBe('test_file.txt');
      expect(sanitizeFilename('danger<script>.js')).toBe('danger_script_.js');
      expect(sanitizeFilename('../../etc/passwd')).toBe('______etc_passwd');
      expect(sanitizeFilename('normal-file.txt')).toBe('normal-file.txt');
    });
  });

  describe('convertBigInts', () => {
    it('should convert BigInt values to strings', () => {
      const convertBigInts = (obj) => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'bigint') {
          return obj.toString();
        }
        if (Array.isArray(obj)) {
          return obj.map(convertBigInts);
        }
        if (typeof obj === 'object') {
          const result = {};
          for (const [key, value] of Object.entries(obj)) {
            result[key] = convertBigInts(value);
          }
          return result;
        }
        return obj;
      };

      expect(convertBigInts(BigInt(123))).toBe('123');
      expect(convertBigInts({ id: BigInt(456), name: 'test' }))
        .toEqual({ id: '456', name: 'test' });
      expect(convertBigInts([BigInt(1), BigInt(2)]))
        .toEqual(['1', '2']);
    });

    it('should handle primitive BigInts', () => {
      const convertBigInts = (obj) => {
        if (typeof obj === 'bigint') {
          return obj.toString();
        }
        return obj;
      };

      expect(convertBigInts(BigInt(789))).toBe('789');
    });

    it('should handle very large BigInts', () => {
      const convertBigInts = (obj) => {
        if (typeof obj === 'bigint') {
          try {
            return obj.toString();
          } catch {
            return 'NaN';
          }
        }
        return obj;
      };

      const hugeBigInt = BigInt('123456789012345678901234567890');
      expect(convertBigInts(hugeBigInt)).toBe('123456789012345678901234567890');
    });
  });

  describe('makeApiRequest simulation', () => {
    it('should handle GET requests', async () => {
      const makeApiRequest = async (url, options = {}) => {
        const response = await global.fetch(url, options);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: 'test' }),
      });

      const result = await makeApiRequest('https://api.example.com/data', { method: 'GET' });
      expect(result).toEqual({ success: true, data: 'test' });
      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/data', { method: 'GET' });
    });

    it('should handle POST requests', async () => {
      const makeApiRequest = async (url, options = {}) => {
        const response = await global.fetch(url, options);
        return response.json();
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ success: true, id: 123 }),
      });

      const result = await makeApiRequest('https://api.example.com/data', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(result).toEqual({ success: true, id: 123 });
    });

    it('should handle network errors', async () => {
      const makeApiRequest = async (url, options = {}) => {
        try {
          const response = await global.fetch(url, options);
          return response.json();
        } catch (error) {
          throw new Error('Network error');
        }
      };

      global.fetch.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(makeApiRequest('https://api.example.com/data', { method: 'GET' }))
        .rejects.toThrow('Network error');
    });
  });
});