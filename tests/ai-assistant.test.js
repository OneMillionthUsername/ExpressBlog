/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Minimal mocks BEFORE importing module
await jest.unstable_mockModule('../public/assets/js/common.js', () => ({
  __esModule: true,
  showAlertModal: jest.fn(),
}));
await jest.unstable_mockModule('../public/assets/js/api.js', () => ({
  __esModule: true,
  makeApiRequest: jest.fn(async () => ({ success: true, data: {} })),
  clearGetResponseCache: jest.fn(),
  getCachedPosts: jest.fn(),
  refreshPosts: jest.fn(async () => []),
  resetCsrfToken: jest.fn(),
  loadAllBlogPosts: jest.fn(async () => []),
  loadCards: jest.fn(async () => []),
}));

global.DOMPurify = { sanitize: (h) => h };

const { generateSummary, generateTags } = await import('../public/assets/js/ai-assistant/ai-assistant.js');

describe('ai-assistant basic integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    const textarea = document.createElement('textarea');
    textarea.id = 'content';
    textarea.value = 'Lorem ipsum '.repeat(20);
    document.body.appendChild(textarea);
    const title = document.createElement('input');
    title.id = 'title';
    title.value = 'Test Titel';
    document.body.appendChild(title);
    const tags = document.createElement('input');
    tags.id = 'tags';
    document.body.appendChild(tags);
    const summaryBtn = document.createElement('button');
    summaryBtn.id = 'ai-summary-btn';
    document.body.appendChild(summaryBtn);
    const tagsBtn = document.createElement('button');
    tagsBtn.id = 'ai-tags-btn';
    document.body.appendChild(tagsBtn);

    global.showNotification = jest.fn();
    global.updatePreview = jest.fn();
    global.tinymce = {
      get: jest.fn(() => ({
        getContent: () => '<p>' + 'Wichtig '.repeat(80) + '</p>',
        selection: { getContent: jest.fn(() => ''), setContent: jest.fn() },
        setContent: jest.fn((html) => { textarea.value = html; }),
      })),
    };
  });

  it('generateSummary inserts summary', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        text: '<p><strong>Zusammenfassung:</strong> Kurzer Test.</p>',
        data: { text: '<p><strong>Zusammenfassung:</strong> Kurzer Test.</p>' },
        candidates: [ { content: { parts: [ { text: '<p><strong>Zusammenfassung:</strong> Kurzer Test.</p>' } ] } } ],
      }),
    }));
    await generateSummary();
    await Promise.resolve();
    const applyBtn = document.querySelector('[data-action="apply-summary"]');
    expect(applyBtn).toBeTruthy();
    applyBtn.click();
    await Promise.resolve();
    expect(document.getElementById('content').value).toContain('Zusammenfassung');
  });

  it('generateTags inserts tags', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        text: 'philosophie, wissenschaft, technik',
        data: { text: 'philosophie, wissenschaft, technik' },
        candidates: [ { content: { parts: [ { text: 'philosophie, wissenschaft, technik' } ] } } ],
      }),
    }));
    await generateTags();
    await Promise.resolve();
    const applyBtn = document.querySelector('[data-action="apply-tags"]');
    expect(applyBtn).toBeTruthy();
    applyBtn.click();
    await Promise.resolve();
    expect(document.getElementById('tags').value).toContain('philosophie');
  });
});
