/**
 * @jest-environment jsdom
 */

import { describe, expect, it, jest, beforeEach, test } from '@jest/globals';

// Import the module first to get all real functions
const actualCommon = await import('../public/assets/js/common.js');

// Create spies for functions we want to monitor
const showNotificationSpy = jest.fn();
const getPostIdFromPathSpy = jest.fn().mockReturnValue(null);
const getPostSlugFromPathSpy = jest.fn().mockReturnValue(null);

// Mock specific functions while keeping the rest real
jest.unstable_mockModule('../public/assets/js/common.js', () => ({
    ...actualCommon,
    showNotification: showNotificationSpy,
    getPostIdFromPath: getPostIdFromPathSpy,
    getPostSlugFromPath: getPostSlugFromPathSpy
}));

// Import the module after mocking
const common = await import('../public/assets/js/common.js');

// Destructure the functions from the imported module
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
    getPostIdFromPath,
    getPostSlugFromPath
} = common;

describe('initializeBlogPostForm', () => {
    let form, titleInput, contentInput, tagsInput, responseMessage;

    beforeEach(() => {
        // Reset spies
        jest.clearAllMocks();
        showNotificationSpy.mockClear();
        getPostIdFromPathSpy.mockClear();
        getPostSlugFromPathSpy.mockClear();

        // Mock global functions
        global.fetch = jest.fn();
        global.makeApiRequest = jest.fn().mockResolvedValue({ message: 'OK' });
        global.showNotification = showNotificationSpy;

        // Add spies to window object as well
        window.getPostIdFromPath = getPostIdFromPathSpy;
        window.getPostSlugFromPath = getPostSlugFromPathSpy;

        // Mock location
        Object.defineProperty(window, 'location', {
            value: { reload: jest.fn(), pathname: '/test' },
            writable: true
        });

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
    it('should not initialize if form does not exist', () => {
        document.body.innerHTML = '';
        expect(() => initializeBlogPostForm()).not.toThrow();
    });
    it('should show error if title is missing', () => {
        titleInput.value = '';
        initializeBlogPostForm();
        const event = new Event('submit');
        form.dispatchEvent(event);
        expect(showNotificationSpy).toHaveBeenCalledWith('Bitte geben Sie einen Titel ein.', 'error');
    });
    it('should show error if content is missing', () => {
        contentInput.value = '';
        initializeBlogPostForm();
        const event = new Event('submit');
        form.dispatchEvent(event);
        expect(showNotificationSpy).toHaveBeenCalledWith('Bitte geben Sie einen Inhalt ein.', 'error');
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
        expect(showNotificationSpy).toHaveBeenCalledWith('Post erfolgreich gespeichert!', 'success');
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
        getPostIdFromPathSpy.mockReturnValue('123');
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
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('shows and removes notification', () => {
        const { showNotification } = actualCommon;
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
        global.location = { reload: jest.fn() };
        global.loadAndDisplayRecentPosts = undefined;
        global.loadAndDisplayArchivePosts = undefined;
        global.loadAndDisplayMostReadPosts = undefined;
        global.loadAndDisplayBlogPost = undefined;
    });
    it('calls loadAndDisplayRecentPosts if defined', () => {
        global.loadAndDisplayRecentPosts = jest.fn();
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

        // Wait for async operations to complete
        await new Promise(resolve => setTimeout(resolve, 100));

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

        // Wait for async operations to complete
        await new Promise(resolve => setTimeout(resolve, 100));

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
            { title: 'A', subtitle: 'B', img_url: 'img', link: 'link', created_at: now },
            { title: 'C', subtitle: 'D', img_url: 'img2', link: 'link2', created_at: now }
        ];
        await renderAndDisplayCards(cards);
        expect(document.getElementById('discoveries-grid').innerHTML).toContain('discovery-card');
        expect(document.getElementById('discoveries-grid').innerHTML).toContain('discovery-title');
    });
});

describe('getPostIdFromPath', () => {
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
    it('returns slug for /blogpost/slug', () => {
        Object.defineProperty(window, 'location', { value: { pathname: '/blogpost/my-slug' }, writable: true });
        expect(common.getPostSlugFromPath()).toBe('my-slug');
    });
    it('returns null for no match', () => {
        Object.defineProperty(window, 'location', { value: { pathname: '/other/path' }, writable: true });
        expect(common.getPostSlugFromPath()).toBeNull();
    });
});
