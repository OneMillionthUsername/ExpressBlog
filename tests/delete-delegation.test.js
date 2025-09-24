/**
 * @jest-environment jsdom
 */

import { jest, beforeEach, afterEach, describe, it, expect } from '@jest/globals';

beforeEach(() => {
  document.body.innerHTML = '';
  jest.clearAllMocks();
  jest.resetModules();
});

afterEach(() => {
  document.body.innerHTML = '';
  jest.restoreAllMocks();
});

describe('admin delegated delete flow', () => {
  it('calls deletePostAndRedirect when confirmModal resolves true', async () => {
    // Prepare mocks before importing admin.js
    const confirmMock = jest.fn().mockResolvedValue(true);
    const deleteMock = jest.fn();

    await jest.unstable_mockModule('../public/assets/js/ui/confirmModal.js', () => ({
      confirmModal: (...args) => confirmMock(...args),
    }));

    await jest.unstable_mockModule('../public/assets/js/common.js', () => ({
      createElement: () => document.createElement('div'),
      elementExists: () => false,
      hideElement: () => {},
      showElement: () => {},
      reloadPageWithDelay: () => {},
      getUrlParameter: () => null,
      deletePostAndRedirect: (...args) => deleteMock(...args),
      redirectEditPost: () => {},
      showCreateCardModal: () => {},
    }));

    // Minimal feedback mock used by admin.js
    await jest.unstable_mockModule('../public/assets/js/feedback.js', () => ({ showFeedback: () => {} }));

    const adminModule = await import('../public/assets/js/admin.js');

    adminModule.initializeAdminDelegation();

    const btn = document.createElement('button');
    btn.dataset.action = 'delete-post';
    btn.dataset.postId = '123';
    document.body.appendChild(btn);

    // Simulate click
    btn.click();

    // Wait for microtasks to complete
    await Promise.resolve();

    expect(confirmMock).toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalledWith('123');
  });

  it('does not call deletePostAndRedirect when confirmModal resolves false', async () => {
    const confirmMock = jest.fn().mockResolvedValue(false);
    const deleteMock = jest.fn();

    await jest.unstable_mockModule('../public/assets/js/ui/confirmModal.js', () => ({
      confirmModal: (...args) => confirmMock(...args),
    }));

    await jest.unstable_mockModule('../public/assets/js/common.js', () => ({
      createElement: () => document.createElement('div'),
      elementExists: () => false,
      hideElement: () => {},
      showElement: () => {},
      reloadPageWithDelay: () => {},
      getUrlParameter: () => null,
      deletePostAndRedirect: (...args) => deleteMock(...args),
      redirectEditPost: () => {},
      showCreateCardModal: () => {},
    }));

    await jest.unstable_mockModule('../public/assets/js/feedback.js', () => ({ showFeedback: () => {} }));

    const adminModule = await import('../public/assets/js/admin.js');

    adminModule.initializeAdminDelegation();

    const btn = document.createElement('button');
    btn.dataset.action = 'delete-post';
    btn.dataset.postId = '456';
    document.body.appendChild(btn);

    // Simulate click
    btn.click();

    // Wait for microtasks to complete
    await Promise.resolve();

    expect(confirmMock).toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
