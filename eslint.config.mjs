import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
    {
        ignores: ['dist/**', 'node_modules/**', 'docs/**', 'src-tauri/**'],
    },
    {
        // 1. Setup: Parser & Globals
        files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: {
                ...globals.browser,
                ...globals.node, // For PostCSS/Tailwind configs
            },
            parser: tseslint.parser,
            parserOptions: {
                project: './tsconfig.eslint.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            react: reactPlugin,
            'react-hooks': reactHooksPlugin,
        },
        settings: {
            react: {
                version: '18.3',
            },
        },

        // 2. Base Rules (Recommended Types)
        extends: [
            js.configs.recommended,
            ...tseslint.configs.recommendedTypeChecked,
            // STRICT correctness, no stylistic fluff
            ...tseslint.configs.strictTypeChecked,
            ...tseslint.configs.stylisticTypeChecked,
        ],

        // 3. User-Directed Overrides (No Style, No Defaults)
        rules: {
            // REACT: Core correctness
            ...reactPlugin.configs.flat.recommended.rules,
            ...reactPlugin.configs.flat['jsx-runtime'].rules,

            // HOOKS: Critical for Zustand/React interaction
            // v7.0.1+ Native Flat Config
            ...reactHooksPlugin.configs.flat.recommended.rules,

            // TYPESCRIPT: Adjustments for "No auto-fix assumptions"
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
            ],
            '@typescript-eslint/consistent-type-definitions': 'off', // Stylistic choice, disabling
            '@typescript-eslint/no-empty-interface': 'off', // Common in placeholder components

            // PROJECT SPECIFIC: Disable stylistic rules that might be in stylisticTypeChecked
            // We want semantic correctness ONLY.
            '@typescript-eslint/prefer-nullish-coalescing': 'error',
            '@typescript-eslint/prefer-optional-chain': 'error',

            // Ensure specific floating promises are handled (Reduces flaky async behavior)
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/await-thenable': 'error',

            // BROWNFIELD: Fire-and-forget patterns are intentional
            '@typescript-eslint/no-confusing-void-expression': 'off',

            // DISABLING formatting/style rules (Prettier/Oxlint territory)
            'indent': 'off',
            'quotes': 'off',
            'semi': 'off',
            'jsx-quotes': 'off',
            'react/jsx-indent': 'off',
            'max-len': 'off',
        },
    },
    {
        // Config files: Disable type checking
        files: ['postcss.config.js', 'tailwind.config.js', 'vite.config.ts'],
        extends: [tseslint.configs.disableTypeChecked],
        languageOptions: {
            parserOptions: {
                project: null
            }
        },
        rules: {
            '@typescript-eslint/no-var-requires': 'off'
        }
    }
);
