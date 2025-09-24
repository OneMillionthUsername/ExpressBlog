/**
 * @jest-environment jsdom
 */

import { jest, beforeEach, afterEach, describe, it, expect } from '@jest/globals';

// Ensure test env flag so makeApiRequest skips CSRF token fetch logic (reduces noise)
process.env.NODE_ENV = 'test';

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
    // Reset module registry to ensure a clean import context
    jest.resetModules();

    // Stub fetch BEFORE importing modules that will use makeApiRequest / adminLogin
    const successfulLoginPayload = {
      success: true,
      data: {
        data: { valid: true, user: { name: 'x', role: 'admin' } },
        token: 'abc',
      },
    };
    global.fetch = jest.fn(async (url, opts) => {
      if (url === '/auth/login') {
        return {
          ok: true,
          status: 200,
          json: async () => successfulLoginPayload,
        };
      }
      if (url === '/auth/verify') {
        return {
          ok: true,
          status: 200,
          json: async () => successfulLoginPayload,
        };
      }
      // Default minimal JSON response
      return { ok: true, status: 200, json: async () => ({}) };
    });

    // Load common first (less dependencies), then admin
    const commonModule = await import('../public/assets/js/common.js');
    const adminModule = await import('../public/assets/js/admin.js');

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

    // Fill credentials (values read by delegated handler)
    modal.querySelector('#admin-username').value = 'testuser';
    modal.querySelector('#admin-password').value = 'testpass123';

    // Trigger delegated submit
    const submitBtn = modal.querySelector('#admin-login-submit');
    submitBtn.click();

    // wait a couple of ticks for async IIFE inside delegation to finish
    await new Promise(r => setTimeout(r, 0));
    await Promise.resolve();

    // Modal should be removed on success
    expect(document.getElementById('admin-login-modal')).toBeFalsy();
  });
});
