import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import vueParser from 'vue-eslint-parser';
import vuePlugin from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';

export default [
  // 忽略
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.pnpm-store/**',
      '*.log',
      'pnpm-lock.yaml',
    ],
  },

  // 基础 JS 规则
  js.configs.recommended,

  // TypeScript 规则
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        // 浏览器全局对象
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
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      // === AGENTS.md 红线规则化 ===
      // 1.1 禁止 Node API
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['fs', 'node:fs', 'path', 'node:path', 'child_process', 'node:child_process', 'buffer', 'node:buffer'],
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

      // 1.6 禁止全局副作用
      'no-global-assign': 'error',
      'no-implicit-globals': 'error',

      // === 通用 TypeScript 规则 ===
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

      // === 调试规范 ===
      'no-console': [
        'warn',
        {
          allow: ['error', 'warn', 'info', 'log'],
        },
      ],
    },
  },

  // Vue 规则
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
    },
    rules: {
      ...vuePlugin.configs['flat/recommended'][0].rules,
      // Vue 3 + script setup 友好
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'warn',
      'vue/require-default-prop': 'off',
    },
  },

  // Prettier 兼容（关闭冲突规则）
  prettier,
];