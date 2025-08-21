// jest.config.js
export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: [".js"], 
  transform: {}, // keine Babel/ts-jest Transformation
  silent: true,
  maxWorkes: 1
};
