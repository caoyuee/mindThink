import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

/**
 * Tauri 集成要点:
 * 1. dev server 端口固定 5181(避免与 web 端 5180 冲突)
 * 2. strictPort:true, 端口冲突时直接报错
 * 3. HMR 走 Tauri webview 的 ws 协议
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5181,
    strictPort: true,
    host: 'localhost',
  },
  // Tauri 在生产环境期待相对路径资源
  base: './',
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
  },
  clearScreen: false,
});
