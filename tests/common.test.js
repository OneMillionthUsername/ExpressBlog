/**
 * @jest-environment jsdom
 */

import { describe, expect, it, jest, beforeEach, test, afterAll } from '@jest/globals';

// Import the module - no mocking needed since we'll mock globals instead
const common = await import('../public/assets/js/common.js');

// Destructure the functions from the imported module (we will spy on some exports)
const {
  initializeBlogPostForm,
  showElement,
  hideElement,
  toggleElementVisibility,
  createElement,
  elementExists,
  waitForElement,
  formatPostDate,
  calculateReadingTime,
  formatContent,
  updateBlogPostUI,
  refreshCurrentPage,
  showCreateCardModal,
  renderAndDisplayCards,
  showNotification,
  getPostIdFromPath,
  getPostSlugFromPath,
} = common;

// Create spies for global functions that the module uses
const showNotificationSpy = jest.fn();
const getPostIdFromPathSpy = jest.fn().mockReturnValue(null);
const getPostSlugFromPathSpy = jest.fn().mockReturnValue(null);

// Helper function to setup global mocks consistently
const setupGlobalMocks = () => {
  // Mock global functions used by the module
  global.fetch = jest.fn();
  // We mock fetch; module functions (makeApiRequest, showNotification, getPostIdFromPath)
  // are exported and will be spied upon directly in tests.
  window.fetch = global.fetch;

  // Mock location
  Object.defineProperty(window, 'location', {
    value: { reload: jest.fn(), pathname: '/test' },
    writable: true,
  });
};

// Helper function to flush promises
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Note: we avoid spying on module-local functions because internal calls in the
// same module reference local bindings. Tests will assert DOM side-effects
// (notifications, response messages) or set `window.location` to control path-based behavior.

// Global cleanup to ensure Jest exits properly
afterAll(async () => {
  // Clear all timers
  jest.clearAllTimers();
  jest.useRealTimers();

  // Clear all mocks
  jest.clearAllMocks();
  jest.resetAllMocks();
  jest.restoreAllMocks();

  // Clear document body completely
  document.body.innerHTML = '';

  // Clear any global variables that might have been set
  delete global.fetch;
  delete global.makeApiRequest;
  delete global.showNotification;
  delete global.getPostIdFromPath;
  delete global.getPostSlugFromPath;

  // Clear window properties
  if (typeof window !== 'undefined') {
    delete window.fetch;
    delete window.makeApiRequest;
    delete window.showNotification;
    delete window.getPostIdFromPath;
    delete window.getPostSlugFromPath;
    delete window.location;
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

describe('initializeBlogPostForm', () => {
  let form, titleInput, contentInput, tagsInput, responseMessage;

  beforeEach(() => {
    // Reset spies
    jest.clearAllMocks();
    showNotificationSpy.mockClear();
    getPostIdFromPathSpy.mockClear();
    getPostSlugFromPathSpy.mockClear();

    // Setup global mocks
    setupGlobalMocks();

    document.body.innerHTML = `
      <form id="blogPostForm"></form>
      <input id="title" value="Test Title" />
      <textarea id="content">Test Content</textarea>
      <input id="tags" value="tag1,tag2" />
      <div id="responseMessage"></div>
      <div id="blogPostsList"></div>
      <div id="discoveries-grid"></div>
    `;
    form = document.getElementById('blogPostForm');
    titleInput = document.getElementById('title');
    contentInput = document.getElementById('content');
    tagsInput = document.getElementById('tags');
    responseMessage = document.getElementById('responseMessage');
    window.fetch = jest.fn();
  });

  afterEach(() => {
    // Clean up timers and mocks after each test
    jest.clearAllTimers();
    jest.clearAllMocks();

    // Clear document body to remove any event listeners
    document.body.innerHTML = '';

    // Clear any remaining DOM elements
    const elements = document.querySelectorAll('*');
    elements.forEach(element => {
      // Remove all event listeners by cloning and replacing
      const cloned = element.cloneNode(true);
      element.parentNode?.replaceChild(cloned, element);
    });

    // Clear window properties that might have been set
    delete window.fetch;
    delete window.makeApiRequest;
    delete window.showNotification;
    delete window.getPostIdFromPath;
    delete window.getPostSlugFromPath;
  });
  it('should not initialize if form does not exist', () => {
    document.body.innerHTML = '';
    expect(() => initializeBlogPostForm()).not.toThrow();
  });
  it('should show error if title is missing', () => {
    titleInput.value = '';
    initializeBlogPostForm();
    const event = new Event('submit');
    form.dispatchEvent(event);
    const notif = document.querySelector('.notification');
    expect(notif).toBeTruthy();
    expect(notif.innerHTML).toContain('Bitte geben Sie einen Titel ein.');
  });
  it('should show error if content is missing', () => {
    contentInput.value = '';
    initializeBlogPostForm();
    const event = new Event('submit');
    form.dispatchEvent(event);
    const notif = document.querySelector('.notification');
    expect(notif).toBeTruthy();
    expect(notif.innerHTML).toContain('Bitte geben Sie einen Inhalt ein.');
  });
  it('should send API request and show success notification', async () => {
    window.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'OK' }),
    });
    initializeBlogPostForm();
    const event = new Event('submit');
    await form.dispatchEvent(event);
    await Promise.resolve();
    expect(window.fetch).toHaveBeenCalled();
    const notif = document.querySelector('.notification');
    expect(notif).toBeTruthy();
    expect(notif.innerHTML).toContain('Post erfolgreich gespeichert!');
  });
  it('should handle server error', async () => {
    window.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Serverfehler' }),
    });
    initializeBlogPostForm();
    const event = new Event('submit');
    await form.dispatchEvent(event);
    await Promise.resolve();
    expect(responseMessage.textContent).toContain('Serverfehler');
  });
  it('should handle fetch error', async () => {
    window.fetch.mockRejectedValue(new Error('Fetch-Fehler'));
    initializeBlogPostForm();
    const event = new Event('submit');
    await form.dispatchEvent(event);
    await Promise.resolve();
    expect(responseMessage.textContent).toContain('Fetch-Fehler');
  });
  it('should send PUT request if editing existing post', async () => {
    // Simulate being on an edit URL so the module's getPostIdFromPath picks it up
    Object.defineProperty(window, 'location', { value: { pathname: '/blogpost/update/123' }, writable: true });
    window.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'OK' }),
    });
    initializeBlogPostForm();
    const event = new Event('submit');
    await form.dispatchEvent(event);
    await Promise.resolve();
    expect(window.fetch).toHaveBeenCalledWith('/blogpost/update/123', expect.any(Object));
  });
  it('should send POST request if creating new post', async () => {
    getPostIdFromPathSpy.mockReturnValue(null);
    window.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'OK' }),
    });
    initializeBlogPostForm();
    const event = new Event('submit');
    await form.dispatchEvent(event);
    await Promise.resolve();
    expect(window.fetch).toHaveBeenCalledWith('/create', expect.any(Object));
  });
});
describe('showElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="testEl" style="display:none"></div>';
  });
  it('shows the element and returns true', () => {
    expect(showElement('testEl')).toBe(true);
    const element = document.getElementById('testEl');
    expect(element.classList.contains('d-block')).toBe(true);
    expect(element.classList.contains('d-none')).toBe(false);
  });
  it('returns false if element does not exist', () => {
    expect(showElement('notExist')).toBe(false);
  });
});
describe('hideElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="testEl" style="display:block"></div>';
  });
  it('hides the element and returns true', () => {
    expect(hideElement('testEl')).toBe(true);
    const element = document.getElementById('testEl');
    expect(element.classList.contains('d-none')).toBe(true);
    expect(element.classList.contains('d-block')).toBe(false);
  });
  it('returns false if element does not exist', () => {
    expect(hideElement('notExist')).toBe(false);
  });
});

describe('toggleElementVisibility', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="testEl" style="display:none"></div>';
  });
  it('shows element if show=true', () => {
    expect(toggleElementVisibility('testEl', true)).toBe(true);
    const element = document.getElementById('testEl');
    expect(element.classList.contains('d-block')).toBe(true);
    expect(element.classList.contains('d-none')).toBe(false);
  });
  it('hides element if show=false', () => {
    expect(toggleElementVisibility('testEl', false)).toBe(true);
    const element = document.getElementById('testEl');
    expect(element.classList.contains('d-none')).toBe(true);
    expect(element.classList.contains('d-block')).toBe(false);
  });
});

describe('createElement', () => {
  it('creates element with attributes and content', () => {
    const el = createElement('div', { id: 'foo', style: { color: 'red' } }, 'bar');
    expect(el.tagName).toBe('DIV');
    expect(el.id).toBe('foo');
    expect(el.style.color).toBe('red');
    expect(el.innerHTML).toBe('bar');
  });
  it('sets cssText if provided', () => {
    const el = createElement('span', { cssText: 'font-weight:bold;' }, 'baz');
    expect(el.style.fontWeight).toBe('bold');
  });
});
describe('elementExists', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="exists"></div>';
  });
  it('returns true if element exists', () => {
    expect(elementExists('exists')).toBe(true);
  });
  it('returns false if element does not exist', () => {
    expect(elementExists('notExist')).toBe(false);
  });
});
describe('waitForElement', () => {
  afterEach(() => {
    // Clean up any pending timers
    jest.clearAllTimers();
  });
    
  it('resolves if element exists', async () => {
    document.body.innerHTML = '<div id="foo"></div>';
    await expect(waitForElement('foo')).resolves.toBeInstanceOf(HTMLElement);
  });
    
  it('waits for element to appear', async () => {
    const timeoutId = setTimeout(() => {
      const el = document.createElement('div');
      el.id = 'bar';
      document.body.appendChild(el);
    }, 100);
        
    try {
      await expect(waitForElement('bar', 500)).resolves.toBeInstanceOf(HTMLElement);
    } finally {
      clearTimeout(timeoutId);
    }
  });
    
  it('rejects if element does not appear', async () => {
    await expect(waitForElement('never', 100)).rejects.toThrow();
  });
});

describe('formatPostDate', () => {
  it('formats date and time', () => {
    const result = formatPostDate('2024-01-02T15:30:00Z');
    expect(result.postDate).toMatch(/2024/);
    expect(result.postTime).toMatch(/\d{2}:\d{2}/);
  });
});
describe('calculateReadingTime', () => {
  it('calculates reading time', () => {
    expect(calculateReadingTime('word '.repeat(400))).toBe(2);
    expect(calculateReadingTime('')).toBe(0);
  });
});
describe('formatContent', () => {
  it('formats content with paragraphs and breaks', () => {
    const input = 'Line1\nLine2\n\nLine3';
    const output = formatContent(input);
    expect(output).toContain('</p><p>');
    expect(output).toContain('<br>');
  });
});
describe('updateBlogPostUI', () => {
  beforeEach(() => {
    setupGlobalMocks();
    document.body.innerHTML = `
            <div id="meta"></div>
            <div id="content"></div>
            <div id="tags"></div>
            <div id="loading"></div>
            <div id="post-article"></div>
            <div id="main-title"></div>
            <div id="description"></div>
        `;
  });
  it('updates UI with post data', () => {
    updateBlogPostUI({
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-02T12:00:00Z',
      content: 'Hello\nWorld',
      tags: ['foo', 'bar'],
      title: 'MyTitle',
      description: 'Desc',
    });
    expect(document.getElementById('meta').innerHTML).toContain('Erstellt am');
    expect(document.getElementById('content').innerHTML).toContain('<p>');
    expect(document.getElementById('tags').innerHTML).toContain('Tags:');
    expect(document.getElementById('main-title').textContent).toBe('MyTitle');
    expect(document.getElementById('description').textContent).toBe('Desc');
    expect(document.getElementById('loading').style.display).toBe('none');
    expect(document.getElementById('post-article').style.display).toBe('block');
  });
});

describe('showNotification', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupGlobalMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('shows and removes notification', () => {
    showNotification('Test message', 'success');
    const notif = document.querySelector('.notification');
    expect(notif).toBeTruthy();
    expect(notif.innerHTML).toContain('Test message');

    // Fast-forward time
    jest.advanceTimersByTime(3000);

    // Wait for animation
    jest.advanceTimersByTime(300);

    expect(document.querySelector('.notification')).toBeFalsy();
  });
});
describe('refreshCurrentPage', () => {
  beforeEach(() => {
    setupGlobalMocks();
    global.location = { reload: jest.fn() };
    global.loadAndDisplayRecentPosts = undefined;
    global.loadAndDisplayArchivePosts = undefined;
    global.loadAndDisplayMostReadPosts = undefined;
    global.loadAndDisplayBlogPost = undefined;
  });
  it('calls loadAndDisplayRecentPosts if defined', () => {
    global.loadAndDisplayRecentPosts = jest.fn();
    window.loadAndDisplayRecentPosts = global.loadAndDisplayRecentPosts;
    refreshCurrentPage();
    expect(global.loadAndDisplayRecentPosts).toHaveBeenCalled();
  });
  it('calls loadAndDisplayArchivePosts if defined', () => {
    global.loadAndDisplayArchivePosts = jest.fn();
    refreshCurrentPage();
    expect(global.loadAndDisplayArchivePosts).toHaveBeenCalled();
  });
  it('calls loadAndDisplayMostReadPosts if defined', () => {
    global.loadAndDisplayMostReadPosts = jest.fn();
    refreshCurrentPage();
    expect(global.loadAndDisplayMostReadPosts).toHaveBeenCalled();
  });
  it('calls loadAndDisplayBlogPost if defined', () => {
    global.loadAndDisplayBlogPost = jest.fn();
    refreshCurrentPage();
    expect(global.loadAndDisplayBlogPost).toHaveBeenCalled();
  });
  it('calls location.reload if no loader functions', () => {
    refreshCurrentPage();
    expect(global.location.reload).toHaveBeenCalled();
  });
});
describe('showCreateCardModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    global.makeApiRequest = jest.fn().mockResolvedValue({ success: true });
    global.showNotification = showNotificationSpy;
    showNotificationSpy.mockClear();

    // Mock showNotification in the global scope since the function uses it directly
    global.showNotification = showNotificationSpy;

    // Also add it to window object
    window.showNotification = showNotificationSpy;
    // Ensure delegated action handlers are active for modal buttons
    if (typeof common.initializeCommonDelegation === 'function') {
      common.initializeCommonDelegation();
    }
  });
    
  afterEach(() => {
    // Clean up any pending timers and DOM elements
    jest.clearAllTimers();
    document.body.innerHTML = '';
  });
    
  it('renders modal and handles submit success', async () => {
    showCreateCardModal();
    const modal = document.getElementById('card-create-modal');
    expect(modal).toBeTruthy();
    const form = modal.querySelector('form');
    modal.querySelector('#card-input-title').value = 'Title';
    modal.querySelector('#card-input-subtitle').value = 'Subtitle';
    modal.querySelector('#card-input-inputImgUrl').value = 'img';
    modal.querySelector('#card-input-inputLink').value = 'link';

    // Trigger the submit event
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // Use microtask instead of setTimeout to avoid hanging timers
    await Promise.resolve();

    // Check that the modal was removed (indicating success)
    expect(document.getElementById('card-create-modal')).toBeFalsy();

    // Check that a notification was added to the DOM
    const notification = document.querySelector('.notification');
    expect(notification).toBeTruthy();
    expect(notification.innerHTML).toContain('Card erstellt!');
  });
  it('handles submit error', async () => {
    global.makeApiRequest.mockRejectedValue(new Error('fail'));
    showCreateCardModal();
    const modal = document.getElementById('card-create-modal');
    const form = modal.querySelector('form');
    modal.querySelector('#card-input-title').value = 'Title';
    modal.querySelector('#card-input-subtitle').value = 'Subtitle';
    modal.querySelector('#card-input-inputImgUrl').value = 'img';
    modal.querySelector('#card-input-inputLink').value = 'link';

    // Trigger the submit event
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // Use microtask instead of setTimeout to avoid hanging timers
    await Promise.resolve();

    // Check that a notification was added to the DOM
    const notification = document.querySelector('.notification');
    expect(notification).toBeTruthy();
    expect(notification.innerHTML).toContain('Fehler im Endpunkt /cards');
  });
  it('removes modal on cancel', () => {
    showCreateCardModal();
    const modal = document.getElementById('card-create-modal');
    const cancelBtn = modal.querySelector('button[type="button"]');
    cancelBtn.click();
    expect(document.getElementById('card-create-modal')).toBeFalsy();
  });
  it('delegated admin login submit works via delegation', async () => {
    // Initialize delegation handlers
    if (typeof common.initializeCommonDelegation === 'function') common.initializeCommonDelegation();

    // Mock API module before importing admin so admin's imported bindings use the mock
    await jest.unstable_mockModule('../public/assets/js/api.js', () => ({
      makeApiRequest: async () => ({ success: true, data: { token: 't', user: { name: 'u' } } }),
      resetCsrfToken: () => {},
      loadAllBlogPosts: async () => [],
    }));

    const admin = await import('../public/assets/js/admin.js');
    if (typeof admin.initializeAdminDelegation === 'function') admin.initializeAdminDelegation();

    // Trigger show-admin-login via delegation
    const showBtn = document.createElement('button');
    showBtn.dataset.action = 'show-admin-login';
    document.body.appendChild(showBtn);
    showBtn.click();

    const modal = document.getElementById('admin-login-modal');
    expect(modal).toBeTruthy();

    modal.querySelector('#admin-username').value = 'user';
    modal.querySelector('#admin-password').value = 'pass1234';

    // Click submit (delegated handler reads inputs)
    const submitBtn = modal.querySelector('#admin-login-submit');
    submitBtn.click();
    await Promise.resolve();

    expect(document.getElementById('admin-login-modal')).toBeFalsy();
  });
});
describe('renderAndDisplayCards', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="discoveries-grid"></div>';
  });
  it('shows no cards message if array empty', async () => {
    await renderAndDisplayCards([]);
    expect(document.getElementById('discoveries-grid').innerHTML).toContain('Noch keine Fundstücke');
  });
  it('renders cards with correct classes', async () => {
    const now = new Date().toISOString();
    const cards = [
      { title: 'A', subtitle: 'B', img_link: 'img', link: 'link', created_at: now },
      { title: 'C', subtitle: 'D', img_link: 'img2', link: 'link2', created_at: now },
    ];
    await renderAndDisplayCards(cards);
    expect(document.getElementById('discoveries-grid').innerHTML).toContain('discovery-card');
    expect(document.getElementById('discoveries-grid').innerHTML).toContain('discovery-title');
  });
});
describe('getPostIdFromPath', () => {
  beforeEach(() => {
    getPostIdFromPathSpy.mockImplementation(() => {
      const match = window.location.pathname.match(/\/blogpost\/(?:delete|update|by-id)\/(\d+)/);
      return match ? match[1] : null;
    });
  });
  it('matches update', () => {
    Object.defineProperty(window, 'location', { value: { pathname: '/blogpost/update/123' }, writable: true });
    expect(common.getPostIdFromPath()).toBe('123');
  });
  it('matches delete', () => {
    Object.defineProperty(window, 'location', { value: { pathname: '/blogpost/delete/456' }, writable: true });
    expect(common.getPostIdFromPath()).toBe('456');
  });
  it('matches by-id', () => {
    Object.defineProperty(window, 'location', { value: { pathname: '/blogpost/by-id/789' }, writable: true });
    expect(common.getPostIdFromPath()).toBe('789');
  });
  it('returns null for no match', () => {
    Object.defineProperty(window, 'location', { value: { pathname: '/blogpost/other' }, writable: true });
    expect(common.getPostIdFromPath()).toBeNull();
  });
});
describe('getPostSlugFromPath', () => {
  beforeEach(() => {
    getPostSlugFromPathSpy.mockImplementation(() => {
      const match = window.location.pathname.match(/\/blogpost\/([^/]+)/);
      return match ? match[1] : null;
    });
  });
  it('returns slug for /blogpost/slug', () => {
    Object.defineProperty(window, 'location', { value: { pathname: '/blogpost/my-slug' }, writable: true });
    expect(common.getPostSlugFromPath()).toBe('my-slug');
  });
  it('returns null for no match', () => {
    Object.defineProperty(window, 'location', { value: { pathname: '/other/path' }, writable: true });
    expect(common.getPostSlugFromPath()).toBeNull();
  });
});