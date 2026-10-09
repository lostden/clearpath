/** SDK-compatible native mocks and Babel transforms come from jest-expo. */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testMatch: ['<rootDir>/tests/**/*.test.[jt]s?(x)'],
  clearMocks: true,
  collectCoverageFrom: ['src/domain/**/*.ts', 'src/data/**/*.ts', 'src/hooks/useAlerts.ts'],
};
