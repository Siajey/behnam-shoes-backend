import {Config} from 'jest'

const config: Config = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '../..',
    testRegex: 's3-file-storage.integration-spec.ts',
    setupFiles: ['<rootDir>/test/integration/setup/setup-env.ts'],
    transform: {
        '^.+\\.[tj]s$': [
            'ts-jest',
            {
                tsconfig: '<rootDir>/test/tsconfig.spec.json',
                allowJs: true,
            },
        ],
    },
    transformIgnorePatterns: [
        '/node_modules/(?!(@nestjs|nestjs-i18n)/)',
    ],
    workerIdleMemoryLimit: 150,
    coverageDirectory: './coverage',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^@common/errors$': '<rootDir>/test/integration/mocks/common-errors.ts',
        '^@app/(.*)$': '<rootDir>/src/$1',
        '^@otp/(.*)$': '<rootDir>/src/otp/$1',
        '^@api/(.*)$': '<rootDir>/src/api/$1',
        '^@common/(.*)$': '<rootDir>/src/common/$1',
    },
}

export default config