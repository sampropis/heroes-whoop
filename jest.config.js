module.exports = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  collectCoverageFrom: [
    'app.ts',
    'paths.ts',
    '!node_modules/**',
    '!__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
}; 