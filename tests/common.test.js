/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest, beforeEach, test } from '@jest/globals';
import { initializeBlogPostForm } from '../public/assets/js/common.js';


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