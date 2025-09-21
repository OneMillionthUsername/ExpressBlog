import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Load DOM environment from jest-environment-jsdom automatically provided
// We'll mock the shared API client so ai-assistant's internal calls go through
// the mocked `makeApiRequest`. This is more stable than mocking functions
// declared inside the same module when using ESM + Jest's VM.
jest.mock('../public/assets/js/api.js', () => {
  return {
    makeApiRequest: jest.fn(),
  };
});

describe('AI assistant generateSummary integration', () => {
  beforeEach(() => {
    // reset DOM
    document.body.innerHTML = '<textarea id="content"></textarea>' +
      '<button id="ai-summary-btn">Summary</button>';

    // stub global helper functions used by the module
    global.showNotification = jest.fn();
    global.updatePreview = jest.fn();
    global.alert = jest.fn();

    // create a fake tinymce with minimal API
    global.tinymce = {
      get: jest.fn(() => ({
        // return a longer HTML string to satisfy the 100-char minimum check
        getContent: () => '<p><strong>Wichtig</strong> Text mit <em>Formatierung</em>. '.repeat(10) + '</p>',
        selection: {
          getContent: jest.fn(() => ''),
          setContent: jest.fn(),
        },
        setContent: jest.fn(function (html) {
          // simulate setting content by updating textarea
          const ta = document.getElementById('content');
          if (ta) ta.value = html;
        }),
      })),
    };

    // Re-import module functions to ensure mocks apply
    jest.resetModules();
  });

  it('generateSummary displays modal and apply-summary inserts HTML into editor', async () => {
    // Arrange: get the mocked API client and set its behavior
    const api = jest.requireMock('../public/assets/js/api.js');
    api.makeApiRequest.mockResolvedValue({
      success: true,
      data: '<p><strong>Zusammenfassung:</strong> Kurzer Text.</p>',
    });

    // Keep fetch mocked as a fallback for other code paths
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: '<p><strong>Zusammenfassung:</strong> Kurzer Text.</p>' }] } },
        ],
      }),
    });

    const mod = await import('../public/assets/js/ai-assistant/ai-assistant.js');

    // Act: call generateSummary (it will call callGeminiAPI which uses mocked fetch)
    await mod.generateSummary();

    // Modal should be present
    const modal = document.querySelector('.ai-modal-container') || document.querySelector('.ai-summary-modal-container') || document.querySelector('.ai-modal-overlay');
    expect(modal).toBeTruthy();

    // find apply button
    const applyBtn = document.querySelector('[data-action="apply-summary"]');
    expect(applyBtn).toBeTruthy();

    // Click apply button
    applyBtn.click();

    // Check that textarea (simulated editor content) was updated
    const ta = document.getElementById('content');
    expect(ta.value).toContain('Zusammenfassung');
  });

  it('generateTags shows modal and apply-tags inserts into #tags', async () => {
    // Arrange: get the mocked API client and set its behavior for tags
    const api = jest.requireMock('../public/assets/js/api.js');
    api.makeApiRequest.mockResolvedValue({
      success: true,
      data: 'philosophie, wissenschaft, technik',
    });

    // Keep fetch mocked as a fallback for other code paths
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: 'philosophie, wissenschaft, technik' }] } },
        ],
      }),
    });

    const mod = await import('../public/assets/js/ai-assistant/ai-assistant.js');

    // ensure a tags input exists
    const tagsInput = document.createElement('input');
    tagsInput.id = 'tags';
    document.body.appendChild(tagsInput);
    // ensure a title input exists so generateTags proceeds
    const titleInput = document.createElement('input');
    titleInput.id = 'title';
    titleInput.value = 'Test Title';
    document.body.appendChild(titleInput);

    await mod.generateTags();

    const modal = document.querySelector('.ai-modal-container') || document.querySelector('.ai-tags-modal-container') || document.querySelector('.ai-modal-overlay');
    expect(modal).toBeTruthy();

    const applyBtn = document.querySelector('[data-action="apply-tags"]');
    expect(applyBtn).toBeTruthy();

    applyBtn.click();
    expect(document.getElementById('tags').value).toContain('philosophie');
  });
});
