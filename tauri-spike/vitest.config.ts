import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // @vitejs/plugin-vue 6.x 与 vitest 2.x 内置的 vite 5 类型不兼容，
  // 运行时 OK，类型断言为 any 抑制插件类型差异。
  plugins: [vue() as never],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/tests/**/*.spec.ts'],
    globals: true,
  },
});
