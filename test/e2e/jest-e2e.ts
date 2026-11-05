import { Config } from 'jest'

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  setupFilesAfterEnv: ['<rootDir>/test/e2e/setup/setup.ts'],
  rootDir: '../..',
  testRegex: 'address.e2e-spec.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/test/tsconfig.spec.json',
      },
    ],
  },
  workerIdleMemoryLimit: 150,
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/$1',
    '^@otp/(.*)$': '<rootDir>/src/otp/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
  },
}

export default config
