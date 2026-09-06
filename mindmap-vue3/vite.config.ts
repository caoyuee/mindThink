import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

/**
 * A3：手动分桶，消除单个 >500 KiB chunk 告警并改善首屏。
 * 路由页面已在 src/router 里全部按需 import()；这里把第三方依赖按类型拆成稳定桶，
 * 避免大 vendor 全部打进入口 chunk。
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

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
});
