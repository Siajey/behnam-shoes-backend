import type { Config } from 'jest'

const config: Config = {
    rootDir: '../../',

    testEnvironment: 'node',

    testMatch: [
        '<rootDir>/test/sandbox/**/*.sandbox-spec.ts',
    ],

    transform: {
        '^.+\\.(t|j)s$': [
            'ts-jest',
            {
                tsconfig: '<rootDir>/tsconfig.json',
            },
        ],
    },

    moduleNameMapper: {
        '^@api/(.*)$': '<rootDir>/src/api/$1',
        '^@common/(.*)$': '<rootDir>/src/common/$1',
    },

    moduleFileExtensions: ['ts', 'js', 'json'],

    clearMocks: true,
    restoreMocks: true,

    testTimeout: 600_000,

    verbose: true,
}

export default config