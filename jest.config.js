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
  // Run tests sequentially in one worker to avoid ESM module-linking races
  maxWorkers: 1,
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/etag.test.js',
    '<rootDir>/tests/mariaDB.test.js'
  ],
  detectOpenHandles: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  resetModules: false, // Disable to avoid ESM issues
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
