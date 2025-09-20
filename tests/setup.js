// Test-Umgebungsvariablen setzen
process.env.JWT_SECRET = 'test_jwt_secret_key_with_at_least_32_characters_for_testing_purposes';
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'test_db';

// Polyfills für jsdom - import dynamically so this file works under ESM test runner
(async () => {
  const util = await import('util');
  global.TextEncoder = util.TextEncoder;
  global.TextDecoder = util.TextDecoder;
})();

// Mock DOMPurify globally for tests before any modules import it.
// Use `globalThis.jest` guard to avoid referencing an undefined `jest` during linting.
try {
  const jestGlobal = typeof globalThis !== 'undefined' ? globalThis.jest : undefined;
  if (jestGlobal && typeof jestGlobal.unstable_mockModule === 'function') {
    jestGlobal.unstable_mockModule('dompurify', () => ({
      default: (win) => ({
        sanitize: jestGlobal.fn((s) => s),
      }),
    }));
  }
} catch (e) {
  // Swallow errors in setup so tests can still attempt to run
  // (Jest will error later if mocks are required in tests)
   
  console.warn('Could not register dompurify mock in setup:', e && e.message);
}

// URL and URLSearchParams polyfills
global.URL = URL;
global.URLSearchParams = URLSearchParams;

// Additional polyfills for jsdom
global.Request = class Request {};
global.Response = class Response {};
global.Headers = class Headers {};
// Note: fetch will be mocked in individual test files if needed