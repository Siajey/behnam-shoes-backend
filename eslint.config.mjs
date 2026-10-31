import {dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import globals from 'globals'
import prettierPlugin from 'eslint-plugin-prettier'
import eslintConfigPrettier from 'eslint-config-prettier'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default [
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/coverage/**',
            '.eslintrc.js',
        ],
    },

    {
        files: ['**/*.ts'],

        languageOptions: {
            parser: tsParser,

            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: __dirname,
                sourceType: 'module',
            },

            globals: {
                ...globals.node,
                ...globals.jest,
            },
        },

        plugins: {
            '@typescript-eslint': tsPlugin,
        },

        rules: {
            ...tsPlugin.configs.recommended.rules,

            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },

    {
        plugins: {
            prettier: prettierPlugin,
        },
        rules: {
            ...eslintConfigPrettier.rules,
            'prettier/prettier': 'error',
        },
    },
]