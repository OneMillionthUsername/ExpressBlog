/**
 * Tests for robust server-config parsing and fallbacks
 */
import { jest, describe, test, expect } from '@jest/globals';

describe('server-config parsing', () => {
  async function loadConfigModule() {
    // Ensure a fresh module instance (resets internal _config cache)
    jest.resetModules();
    return await import('../public/assets/js/config.js');
  }

  test('parses clean JSON text content', async () => {
    document.body.innerHTML = `
      <script id="server-config" type="application/json">{"isAdmin":true,"assetVersion":"v123"}</script>
    `;

    const { getServerConfig, isAdminFromServer, getAssetVersion } = await loadConfigModule();
    const cfg = getServerConfig();

    expect(cfg).toEqual({ isAdmin: true, assetVersion: 'v123' });
    expect(isAdminFromServer()).toBe(true);
    expect(getAssetVersion()).toBe('v123');
  });

  test('parses JSON with injected noise by locating braces', async () => {
    document.body.innerHTML = `
      <script id="server-config" type="application/json">/* prefix */ {"isAdmin":false,"assetVersion":"abc"} /* suffix */</script>
    `;

    const { getServerConfig, isAdminFromServer, getAssetVersion } = await loadConfigModule();
    const cfg = getServerConfig();

    expect(cfg).toEqual({ isAdmin: false, assetVersion: 'abc' });
    expect(isAdminFromServer()).toBe(false);
    expect(getAssetVersion()).toBe('abc');
  });

  test('falls back to data-* attributes when text is empty or unparsable', async () => {
    document.body.innerHTML = `
      <script id="server-config" type="application/json" data-is-admin="true" data-asset-version="fallbackV"></script>
    `;

    const { getServerConfig, isAdminFromServer, getAssetVersion } = await loadConfigModule();
    const cfg = getServerConfig();

    expect(cfg).toEqual({ isAdmin: true, assetVersion: 'fallbackV' });
    expect(isAdminFromServer()).toBe(true);
    expect(getAssetVersion()).toBe('fallbackV');
  });

  test('returns empty object when element missing', async () => {
    document.body.innerHTML = '';
    const { getServerConfig } = await loadConfigModule();
    expect(getServerConfig()).toEqual({});
  });
});
