module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/client/utils/**/*.ts',
    'src/client/parser/parseClassBlocksWithBraceCounting.ts',
    'src/client/theme.ts'
  ],
  coverageThreshold: {
    global: {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100
    }
  }
};
