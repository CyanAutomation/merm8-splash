import nextPlugin from '@next/eslint-plugin-next';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    ignores: ['.next/**', 'node_modules/**', 'dist/**', 'build/**', 'out/**', 'playwright-report/**', 'test-results/**'],
  },
  {
    files: ['**/*.{ts,tsx}', '!**/tests/**'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        React: 'readonly',
      },
    },
    plugins: {
      '@next/next': nextPlugin,
      '@typescript-eslint': typescriptPlugin,
    },
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...typescriptPlugin.configs['recommended'].rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.nodeBuiltin,
      },
    },
    rules: {
      'no-undef': 'off',
      'no-useless-escape': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
