import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        // Node.js modules
        fs: 'readonly',
        path: 'readonly',
        crypto: 'readonly',
        // Web APIs
        URL: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-console': 'off',
      'no-undef': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'indent': ['error', 2],
      'comma-dangle': ['error', 'always-multiline'],
      'no-import-assign': 'off'
    },
    ignores: [
      'node_modules/',
      'coverage/',
      'logs/',
      '*.config.js',
      'jest.config.js',
      'babel.config.js',
      'public/', // Ignore frontend files
      'views/BildHochladen.js' // Platzhalter-Datei
    ]
  },
  // Separate config for test files
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        // Browser globals for tests
        window: 'readonly',
        document: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        location: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        MutationObserver: 'readonly',
        CustomEvent: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        HTMLElement: 'readonly',
        Event: 'readonly',
        // Test globals
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        setImmediate: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'off' // Allow unused variables in tests
    }
  }
];
