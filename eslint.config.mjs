import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
    baseDirectory: __dirname,
});

export default [
    {
        ignores: [
            '**/.eslintrc.js',
            '**/node_modules/**',
            '**/dist/**',
            '**/coverage/**',
            '**/dist//**',
            '**/jest.config.js/**',
            '**/.eslintrc.js/**',
            '**/.prettierrc/**',
            '**/node_modules/**',
        ],
    },

    ...compat.config({
        parser: '@typescript-eslint/parser',

        parserOptions: {
            project: 'tsconfig.json',
            tsconfigRootDir: __dirname,
            sourceType: 'module',
        },

        plugins: ['@typescript-eslint/eslint-plugin'],

        extends: [
            'plugin:@typescript-eslint/recommended',
            'plugin:prettier/recommended',
        ],

        root: true,

        env: {
            node: true,
            jest: true,
        },

        rules: {
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
        },
    }),
];