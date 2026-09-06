import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

/**
 * A3：手动分桶，消除单个 >500 KiB chunk 告警并改善首屏。
 * 路由页面已在 src/router 里全部按需 import()；这里把第三方依赖按类型拆成稳定桶，
 * 避免大 vendor 全部打进入口 chunk。base './' 下 Vite 会为懒加载 chunk 生成相对路径，
 * 打包后由 Tauri 托盘加载即可，无需改 base 语义。
 */
function manualChunks(id: string): string | undefined {
  // pnpm 会解析到 node_modules/.pnpm/<pkg>@x/node_modules/<pkg> 的真实路径，
  // 因此必须取最后一个 /node_modules/ 之后的包名；同时统一 Windows 分隔符。
  const nid = id.replace(/\\/g, '/');
  const marker = '/node_modules/';
  const i = nid.lastIndexOf(marker);
  if (i < 0) return undefined;
  const top = /^(@[^/]+\/)?[^/]+/.exec(nid.slice(i + marker.length))?.[0];
  if (!top) return undefined;
  if (
    top === 'vue' ||
    top === 'vue-router' ||
    top === 'pinia' ||
    top === 'vue-i18n' ||
    top.startsWith('@vue/')
  ) {
    return 'vue-vendor';
  }
  if (top === 'markmap-lib' || top === 'markmap-view' || top === 'markmap-toolbar') {
    return 'markmap';
  }
  // markmap-lib 的 Markdown 渲染管线（markdown-it + KaTeX + highlight.js）较重。
  if (
    top === 'katex' ||
    top === 'highlight.js' ||
    top.includes('markdown-it') ||
    top === '@vscode/markdown-it-katex'
  ) {
    return 'markmap-md';
  }
  // markmap-view 依赖 d3 伞包及其 d3-* 子包。
  if (top === 'd3' || top.startsWith('d3-')) {
    return 'd3';
  }
  return 'vendor';
}

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
    watch: {
      // Tauri 编译产物里包含被 Windows 锁定的 .exe（即使没有 dev server 也可能占用）。
      // 同时 .rs 文件不应触发前端热更新。
      ignored: ['**/src-tauri/target/**', '**/*.rs', '**/.git/**'],
    },
  },
  // Tauri 在生产环境期待相对路径资源
  base: './',
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  clearScreen: false,
});
