/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',
  transform: {
    '^.+\\.svelte$': 'svelte-jester',
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
    '\\.[jt]sx?$': 'babel-jest'
  },
  moduleNameMapper: {
    '^\\$app/(.*)$': '<rootDir>/src/__mocks__/$app/$1',
    '^\\$env/(.*)$': '<rootDir>/src/__mocks__/$env/$1',
    '^\\$lib/(.*)$': '<rootDir>/src/lib/$1'
  }
};
