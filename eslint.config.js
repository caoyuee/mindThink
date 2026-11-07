import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import vueParser from 'vue-eslint-parser';
import vuePlugin from 'eslint-plugin-vue';
// eslint-config-prettier v9 exports a plain { rules } object, which is a valid
// flat-config entry. It MUST remain the LAST item: it switches off every ESLint
// rule that would fight Prettier (quotes / semi / indent / comma-dangle / ...).
// Formatting is a separate step (`pnpm format` / `pnpm format:check`), which is
// Prettier's officially recommended setup - no eslint-plugin-prettier, no fix
// loops. `pnpm fix` runs ESLint first and Prettier last so the two never undo
// each other's work.
import prettier from 'eslint-config-prettier';

const BROWSER_GLOBALS = {
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  Blob: 'readonly',
  File: 'readonly',
  FormData: 'readonly',
  AbortController: 'readonly',
  HTMLElement: 'readonly',
  HTMLInputElement: 'readonly',
  SVGSVGElement: 'readonly',
  SVGGElement: 'readonly',
  Element: 'readonly',
  MouseEvent: 'readonly',
  Event: 'readonly',
  EventTarget: 'readonly',
  KeyboardEvent: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  Promise: 'readonly',
};

export default [
  // Generated files / dependencies / read-only artefacts
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '.pnpm-store/**',
      'pnpm-lock.yaml',
      '**/*.tsbuildinfo',
      '**/*.log',
      // Vite / Vitest transient config files (vitest.config.ts.timestamp-*.mjs)
      '**/*.timestamp-*.mjs',
      '**/src-tauri/target/**',
      '**/src-tauri/gen/**',
      // Node-side build tooling (icon generation etc.), not webview code
      '**/scripts/**',
      // Read-only historical snapshot
      'legacy/**',
      '.workbuddy/**',
      '.Trash-0/**',
    ],
  },

  // Baseline JS rules
  js.configs.recommended,

  // TypeScript rules
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: BROWSER_GLOBALS,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      // TypeScript itself checks undefined identifiers; ESLint's no-undef
      // produces false positives on TS-only globals and types.
      'no-undef': 'off',

      // === AGENTS.md red lines, enforced by lint ===
      // 1.1 No Node APIs in the webview render layer
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'fs',
                'node:fs',
                'path',
                'node:path',
                'child_process',
                'node:child_process',
                'buffer',
                'node:buffer',
              ],
              message: 'AGENTS.md 1.1: 禁止在 webview 渲染层使用 Node API。文件操作走 core/file.ts',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'Buffer',
        'process',
        '__dirname',
        '__filename',
        'require',
        'module',
        'exports',
      ],

      // 1.6 No implicit global side effects
      'no-global-assign': 'error',
      'no-implicit-globals': 'error',

      // General TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Debug hygiene (AGENTS.md 7); console.log still needs a // DEBUG: reason
      'no-console': ['warn', { allow: ['error', 'warn', 'info', 'log'] }],
    },
  },

  // Vue rules
  ...vuePlugin.configs['flat/recommended'].map((c) => ({
    ...c,
    files: ['**/*.vue'],
  })),
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
      globals: BROWSER_GLOBALS,
    },
    rules: {
      // Vue 3 <script setup> friendly
      'no-undef': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'warn',
      'vue/require-default-prop': 'off',
    },
  },

  // Prettier compatibility: disable conflicting ESLint rules (keep last!)
  prettier,
];
