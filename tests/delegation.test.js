/**
 * @jest-environment jsdom
 */

import { jest, beforeEach, afterEach, describe, it, expect } from '@jest/globals';

beforeEach(() => {
  document.body.innerHTML = '';
  jest.clearAllMocks();
});

afterEach(() => {
  document.body.innerHTML = '';
  jest.restoreAllMocks();
});

describe('delegation initializers', () => {
  it('should open admin login modal via delegated action and submit via delegation', async () => {
    // Reset module registry to avoid cross-test ESM linking issues
    jest.resetModules();

    // Mock API module before importing other modules so their imported bindings are mocked
    await jest.unstable_mockModule('../public/assets/js/api.js', () => ({
      makeApiRequest: async () => ({ success: true, data: { token: 'abc', user: { name: 'x' } } }),
      resetCsrfToken: () => {},
      loadAllBlogPosts: async () => [],
    }));

    const adminModule = await import('../public/assets/js/admin.js');
    const commonModule = await import('../public/assets/js/common.js');

    // Ensure delegation is initialized
    commonModule.initializeCommonDelegation();
    adminModule.initializeAdminDelegation();

    // Add a button that delegates to show-admin-login
    const btn = document.createElement('button');
    btn.dataset.action = 'show-admin-login';
    document.body.appendChild(btn);

    // Click to open modal
    btn.click();

    const modal = document.getElementById('admin-login-modal');
    expect(modal).toBeTruthy();

    // Fill credentials
    modal.querySelector('#admin-username').value = 'testuser';
    modal.querySelector('#admin-password').value = 'testpass123';

    // Mock makeApiRequest to succeed before importing admin/common to ensure the module uses the mock
    await jest.unstable_mockModule('../public/assets/js/api.js', () => ({
      makeApiRequest: async () => ({ success: true, data: { token: 'abc', user: { name: 'x' } } }),
      resetCsrfToken: () => {},
      loadAllBlogPosts: async () => [],
    }));

    // Trigger delegated submit
    const submitBtn = modal.querySelector('#admin-login-submit');
    submitBtn.click();

    // wait a tick for async handler
    await Promise.resolve();

    // Modal should be removed on success
    expect(document.getElementById('admin-login-modal')).toBeFalsy();
  });
});
