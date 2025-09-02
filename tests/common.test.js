/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest, beforeEach, test } from '@jest/globals';
import { initializeBlogPostForm } from '../public/assets/js/common.js';
import {
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
  showNotification,
  getPostIdFromPath,
  getPostSlugFromPath
} from '../public/assets/js/common.js';


describe('initializeBlogPostForm', () => {
  let form, titleInput, contentInput, tagsInput, responseMessage;

  beforeEach(() => {
    document.body.innerHTML = `
      <form id="blogPostForm"></form>
      <input id="title" value="Test Title" />
      <textarea id="content">Test Content</textarea>
      <input id="tags" value="tag1,tag2" />
      <div id="responseMessage"></div>
    `;
    form = document.getElementById('blogPostForm');
    titleInput = document.getElementById('title');
    contentInput = document.getElementById('content');
    tagsInput = document.getElementById('tags');
    responseMessage = document.getElementById('responseMessage');
    window.fetch = jest.fn();
    window.showNotification = jest.fn();
    window.getPostIdFromPath = jest.fn().mockReturnValue(null);
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
    expect(window.showNotification).toHaveBeenCalledWith('Bitte geben Sie einen Titel ein.', 'error');
  });
  it('should show error if content is missing', () => {
    contentInput.value = '';
    initializeBlogPostForm();
    const event = new Event('submit');
    form.dispatchEvent(event);
    expect(window.showNotification).toHaveBeenCalledWith('Bitte geben Sie einen Inhalt ein.', 'error');
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
    expect(window.showNotification).toHaveBeenCalledWith('Post erfolgreich gespeichert!', 'success');
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
    window.getPostIdFromPath.mockReturnValue('123');
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
    window.getPostIdFromPath.mockReturnValue(null);
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
        expect(document.getElementById('testEl').style.display).toBe('block');
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
        expect(document.getElementById('testEl').style.display).toBe('none');
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
        expect(document.getElementById('testEl').style.display).toBe('block');
    });
    it('hides element if show=false', () => {
        expect(toggleElementVisibility('testEl', false)).toBe(true);
        expect(document.getElementById('testEl').style.display).toBe('none');
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
    it('resolves if element exists', async () => {
        document.body.innerHTML = '<div id="foo"></div>';
        await expect(waitForElement('foo')).resolves.toBeInstanceOf(HTMLElement);
    });
    it('waits for element to appear', async () => {
        setTimeout(() => {
            const el = document.createElement('div');
            el.id = 'bar';
            document.body.appendChild(el);
        }, 100);
        await expect(waitForElement('bar', 500)).resolves.toBeInstanceOf(HTMLElement);
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
            description: 'Desc'
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
    it('shows and removes notification', () => {
        showNotification('Test message', 'success');
        const notif = document.querySelector('.notification');
        expect(notif).toBeTruthy();
        expect(notif.innerHTML).toContain('Test message');
        jest.advanceTimersByTime(3000);
        setTimeout(() => {
            expect(document.querySelector('.notification')).toBeFalsy();
        }, 400);
    });
});

describe('getPostIdFromPath', () => {
    it('returns postId from pathname', () => {
        Object.defineProperty(window, 'location', {
            value: { pathname: '/blogpost/update/42' },
            writable: true
        });
        expect(getPostIdFromPath()).toBe('42');
    });
    it('returns null if no match', () => {
        Object.defineProperty(window, 'location', {
            value: { pathname: '/other/path' },
            writable: true
        });
        expect(getPostIdFromPath()).toBeNull();
    });
});

describe('getPostSlugFromPath', () => {
    it('returns slug from pathname', () => {
        Object.defineProperty(window, 'location', {
            value: { pathname: '/blogpost/my-slug' },
            writable: true
        });
        expect(getPostSlugFromPath()).toBe('my-slug');
    });
    it('returns null if no match', () => {
        Object.defineProperty(window, 'location', {
            value: { pathname: '/other/path' },
            writable: true
        });
        expect(getPostSlugFromPath()).toBeNull();
    });
});