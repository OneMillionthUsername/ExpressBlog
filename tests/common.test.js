/**
 * @jest-environment jsdom
 */

import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

// Mock api.js before importing common.js
jest.unstable_mockModule('../public/assets/js/api.js', () => ({
  loadAllBlogPosts: jest.fn(),
  loadPost: jest.fn(),
  loadComments: jest.fn(),
  saveComment: jest.fn(),
  deleteComment: jest.fn(),
  logAction: jest.fn(),
  makeApiRequest: jest.fn(),
  clearGetResponseCache: jest.fn(),
  getCachedPosts: jest.fn(),
  refreshPosts: jest.fn(),
  resetCsrfToken: jest.fn(),
  loadCards: jest.fn(),
}));

// Import common.js after mocking its dependencies
const commonModule = await import('../public/assets/js/common.js');

describe('Common.js Functions', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Mock console methods to avoid noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock location
    delete window.location;
    window.location = { 
      pathname: '/test', 
      reload: jest.fn(),
      href: 'http://localhost:3000/test',
    };
    
    // Mock global variables that common.js might expect
    window.isAdminLoggedIn = false;
    window.currentUser = null;
    
    // Mock DOMPurify properly
    global.DOMPurify = {
      sanitize: jest.fn((html, options) => {
        if (options && options.ALLOWED_TAGS && options.ALLOWED_TAGS.length === 0) {
          // Strip all tags when ALLOWED_TAGS is empty
          return html.replace(/<[^>]*>/g, '');
        }
        return html;
      }),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('DOM Manipulation Functions', () => {
    it('should show elements by ID', () => {
      const element = document.createElement('div');
      element.id = 'test-element';
      element.style.display = 'none';
      document.body.appendChild(element);

      commonModule.showElement('test-element');
      expect(element.style.display).toBe(''); // showElement sets display to empty string
      expect(element.classList.contains('d-block')).toBe(true);
      expect(element.classList.contains('d-none')).toBe(false);
    });

    it('should hide elements by ID', () => {
      const element = document.createElement('div');
      element.id = 'test-element';
      element.style.display = 'block';
      document.body.appendChild(element);

      commonModule.hideElement('test-element');
      expect(element.style.display).toBe('none');
    });

    it('should create elements with attributes', () => {
      const element = commonModule.createElement('div', {
        id: 'test-id',
        class: 'test-class',
      });

      expect(element.tagName).toBe('DIV');
      expect(element.id).toBe('test-id');
      expect(element.className).toBe('test-class');
    });

    it('should check if element exists', () => {
      const element = document.createElement('div');
      element.id = 'exists-test';
      document.body.appendChild(element);

      expect(commonModule.elementExists('exists-test')).toBe(true);
      expect(commonModule.elementExists('nonexistent')).toBe(false);
    });
  });

  describe('Content Processing Functions', () => {
    it('should strip HTML tags', () => {
      const htmlString = '<p>Hello <strong>world</strong>!</p>';
      const result = commonModule.stripHtml(htmlString);
      
      expect(result).toBe('Hello world!');
    });

    it('should create excerpt from HTML', () => {
      const longHtml = '<p>A very long text that should be truncated</p>';
      const excerpt = commonModule.createExcerptFromHtml(longHtml, 20);
      
      expect(excerpt.length).toBeLessThanOrEqual(23);
      expect(excerpt).toContain('...');
    });

    it('should format content', () => {
      const content = 'Some content';
      const formatted = commonModule.formatContent(content);
      
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('Date and Time Functions', () => {
    it('should format post date correctly', () => {
      const testDate = '2023-12-01T10:30:00Z';
      const formatted = commonModule.formatPostDate(testDate);
      
      expect(typeof formatted).toBe('object');
      expect(formatted).toHaveProperty('postDate');
      expect(formatted).toHaveProperty('postTime');
      expect(typeof formatted.postDate).toBe('string');
      expect(typeof formatted.postTime).toBe('string');
    });

    it('should calculate reading time', () => {
      const shortText = 'This is a short text.';
      const longText = 'This is a much longer text. '.repeat(50);
      
      const shortTime = commonModule.calculateReadingTime(shortText);
      const longTime = commonModule.calculateReadingTime(longText);
      
      expect(shortTime).toBe(1);
      expect(longTime).toBeGreaterThan(shortTime);
    });
  });

  describe('Notification Functions', () => {
    it('should show notification', () => {
      commonModule.showNotification('Test message', 'success');
      
      const notification = document.querySelector('.notification');
      expect(notification).toBeTruthy();
    });
  });

  describe('Basic functionality test', () => {
    it('should verify common.js module loads correctly', () => {
      expect(commonModule).toBeDefined();
      expect(typeof commonModule.showElement).toBe('function');
      expect(typeof commonModule.hideElement).toBe('function');
      expect(typeof commonModule.createElement).toBe('function');
      expect(typeof commonModule.stripHtml).toBe('function');
      expect(typeof commonModule.formatPostDate).toBe('function');
      expect(typeof commonModule.calculateReadingTime).toBe('function');
    });
  });
});