export default {
  preset: null,
  extensionsToTreatAsEsm: [],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // No transforms: running in Node >=18 with experimental vm modules for ESM support
  transform: {},
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout: 10000,
  // Run tests sequentially in one worker to avoid ESM module-linking races with
  // unstable_mockModule when tests register ESM mocks dynamically. This is a
  // conservative measure; if you prefer parallel runs, we should refactor tests
  // to avoid global unstable_mockModule side-effects.
  maxWorkers: 1,
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/etag.test.js'
  ],
  // forceExit: true, // Removed to prevent early environment teardown
  detectOpenHandles: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // resetModules: true, // Commented out to avoid ESM module-linking issues
  testEnvironmentOptions: {
    html: '<html lang="zh-cmn-Hant"></html>',
    url: 'https://jestjs.io/',
    userAgent: 'Agent/007',
  },
  collectCoverageFrom: [
    'public/assets/js/**/*.js',
    'controllers/**/*.js',
    'models/**/*.js',
    'routes/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ]
};
