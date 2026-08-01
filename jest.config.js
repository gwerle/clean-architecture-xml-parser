module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '\\.(e2e-)?spec\\.ts$',
  // Modules and the bootstrap are DI wiring, exercised by starting the app, not by unit tests.
  collectCoverageFrom: ['src/**/*.ts', '!src/infra/main.ts', '!src/**/*.module.ts'],
  coverageThreshold: {
    global: { statements: 95, branches: 85, functions: 95, lines: 95 },
  },
};
