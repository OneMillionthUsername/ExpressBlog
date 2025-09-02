// jest.config.js
export default {
  testEnvironment: 'jsdom',
  transform: {}, // keine Babel/ts-jest Transformation
  setupFilesAfterEnv: ['./setup.js'],
  //silent: true,
  maxWorkers: 1,
  moduleFileExtensions: ['js', 'json'],
  testMatch: [
    '**/*.test.js'
  ]
};
