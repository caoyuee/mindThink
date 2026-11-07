import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { buildAliases } from '../../build/aliases';

export default defineConfig({
  // @vitejs/plugin-vue 6.x 与 vitest 2.x 内置的 vite 5 类型不兼容，
  // 运行时 OK，类型断言为 any 抑制插件类型差异。
  plugins: [vue() as never],
  resolve: {
    alias: buildAliases(import.meta.url),
    // packages/* 源码在 app 目录树之外，裸导入 vue/pinia 等会解析到根 node_modules
    // 的另一份实体，造成双实例（pinia 单例态、vue provide/inject 都会炸）。
    // dedupe 强制这些依赖全模块图单实例。
    dedupe: ['vue', 'vue-router', 'pinia', 'vue-i18n', 'nanoid', 'markmap-view'],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/tests/**/*.spec.ts'],
    globals: true,
  },
});
