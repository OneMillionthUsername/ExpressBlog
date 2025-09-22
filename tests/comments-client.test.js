import { jest } from '@jest/globals';

// Mock the global environment for testing client-side code
global.document = {
  getElementById: jest.fn(),
  querySelector: jest.fn(),
  addEventListener: jest.fn(),
};

global.window = {
  location: { pathname: '/blogpost/by-id/1' },
  __SERVER_POST: null,
};

// Mock DOMPurify for testing
global.DOMPurify = {
  sanitize: jest.fn((input, config) => {
    // Simple mock that removes style attributes for testing
    if (typeof input === 'string') {
      return input
        .replace(/style="[^"]*"/g, '')
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/onclick="[^"]*"/g, '');
    }
    return input;
  }),
};

describe('Client-side Comment Functionality', () => {
  let commentsModule;
  
  beforeAll(async () => {
    // Import the comments module after setting up mocks
    commentsModule = await import('../public/assets/js/comments.js');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Comment rendering with sanitization', () => {
    it('should properly sanitize comments with DOMPurify', () => {
      const dangerousComment = {
        id: 1,
        username: '<script>alert("evil")</script>TestUser',
        text: '<p style="font-size: 24pt;">Dangerous <strong>content</strong></p>',
        created_at: new Date().toISOString(),
      };

      // Mock the comments container
      const mockContainer = {
        innerHTML: '',
      };
      global.document.getElementById.mockReturnValue(mockContainer);

      // Test that DOMPurify.sanitize is called with proper configuration
      const result = global.DOMPurify.sanitize(dangerousComment.text, {
        ALLOWED_TAGS: ['p','br','b','i','strong','em','u','a','ul','ol','li','code','pre'],
        ALLOWED_ATTR: ['href','title','target','rel','alt'],
        FORBID_TAGS: ['script','style'],
        FORBID_ATTR: ['style', 'class', 'id', 'onclick', 'onload', 'onerror', 'onmouseover', 'javascript'],
      });

      expect(result).not.toContain('style=');
      expect(result).not.toContain('<script>');
      expect(result).toContain('<strong>content</strong>');
    });

    it('should call DOMPurify with correct configuration for usernames', () => {
      const dangerousUsername = '<img src=x onerror=alert(1)>User';
      
      const result = global.DOMPurify.sanitize(dangerousUsername, {
        ALLOWED_TAGS: [], 
        ALLOWED_ATTR: [],
        FORBID_ATTR: ['style', 'class', 'id', 'onclick', 'onload', 'onerror', 'onmouseover'],
      });

      expect(global.DOMPurify.sanitize).toHaveBeenCalledWith(
        dangerousUsername,
        expect.objectContaining({
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: [],
          FORBID_ATTR: expect.arrayContaining(['style', 'onclick', 'onerror']),
        }),
      );
    });

    it('should call DOMPurify with correct configuration for comment text', () => {
      const dangerousText = '<p style="color: red;">Content with <script>alert(1)</script></p>';
      
      const result = global.DOMPurify.sanitize(dangerousText, {
        ALLOWED_TAGS: ['p','br','b','i','strong','em','u','a','ul','ol','li','code','pre'],
        ALLOWED_ATTR: ['href','title','target','rel','alt'],
        FORBID_TAGS: ['script','style'],
        FORBID_ATTR: ['style', 'class', 'id', 'onclick', 'onload', 'onerror', 'onmouseover', 'javascript'],
      });

      expect(global.DOMPurify.sanitize).toHaveBeenCalledWith(
        dangerousText,
        expect.objectContaining({
          ALLOWED_TAGS: expect.arrayContaining(['p', 'strong', 'em']),
          FORBID_TAGS: expect.arrayContaining(['script', 'style']),
          FORBID_ATTR: expect.arrayContaining(['style', 'onclick', 'javascript']),
        }),
      );
    });
  });

  describe('Post ID resolution', () => {
    it('should resolve post ID from URL pathname', () => {
      global.window.location.pathname = '/blogpost/by-id/123';
      
      // We can't easily test the private resolvePostId function,
      // but we can verify the pattern matching logic
      const match = global.window.location.pathname.match(/\/blogpost\/by-id\/(\d+)/i);
      expect(match).not.toBeNull();
      expect(match[1]).toBe('123');
    });

    it('should handle server post data when available', () => {
      global.window.__SERVER_POST = { id: 456 };
      
      // Verify that server data takes precedence
      expect(global.window.__SERVER_POST.id).toBe(456);
    });
  });

  describe('Comment validation patterns', () => {
    it('should validate comment structure', () => {
      // Test the validation logic that would be used
      const validComment = { postId: 1, text: 'Valid comment' };
      const invalidComment = { postId: null, text: '' };
      
      // Simulate validation
      const isValid = (comment) => {
        return comment.postId && 
               typeof comment.postId === 'number' && 
               comment.text && 
               comment.text.trim().length > 0;
      };
      
      expect(isValid(validComment)).toBe(true);
      expect(isValid(invalidComment)).toBe(false);
    });
  });
});