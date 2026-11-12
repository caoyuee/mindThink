import { fileURLToPath, URL } from 'node:url';

/**
 * 单一别名事实源（M0-6 monorepo）
 *
 * 背景：共享源码已抽取到 packages/{core,ui,i18n}，但包内代码仍通过 `@/` 别名
 * 引用各 app 的平台分歧文件（如 MindEditor.vue → @/stores/mindmap）。
 * 本函数供两 app 的 vite.config.ts / vitest.config.ts 调用，保证两端别名永远一致。
 *
 * 规则：具体前缀在前、'@/' 兜底最后（vite 字符串别名只在「完全相等或后随 /」时命中，
 * 别名 '@/core' 不会误吞 '@/coreX' 这类更长的包名）。
 *
 * @param appDirUrl 调用方 app 的目录 URL（如 `import.meta.url`）
 */
export function buildAliases(appDirUrl: string): { find: string; replacement: string }[] {
  const appSrc = fileURLToPath(new URL('./src', appDirUrl));
  const pkg = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, appDirUrl));
  return [
    // —— app 专属（平台分歧）文件优先 ——
    { find: '@/core/document-title', replacement: `${appSrc}/core/document-title.ts` },
    { find: '@/core/tauri-file', replacement: `${appSrc}/core/tauri-file.ts` },
    { find: '@/core/web-file', replacement: `${appSrc}/core/web-file.ts` },
    { find: '@/core/file', replacement: `${appSrc}/core/file.ts` },
    // —— packages/core ——
    { find: '@/core', replacement: pkg('core/src/core') },
    { find: '@/platform', replacement: pkg('core/src/platform.ts') },
    { find: '@/types', replacement: pkg('core/src/types') },
    // —— i18n：逻辑在包，locales 文案属平台分歧留在各 app ——
    { find: '@/i18n/locales', replacement: `${appSrc}/i18n/locales` },
    { find: '@/i18n', replacement: pkg('i18n/src/index.ts') },
    // —— packages/ui（stores/ui 是共享的，stores/config|mindmap 是分歧的）——
    { find: '@/stores/ui', replacement: pkg('ui/src/stores/ui.ts') },
    { find: '@/stores', replacement: `${appSrc}/stores` },
    { find: '@/composables', replacement: pkg('ui/src/composables') },
    // Toolbar / AppStatusBar 是平台分歧组件，但被共享文件（EditorView/App）以
    // '@/components/...' 引用 —— 精确别名优先落到各 app 自己的副本。
    // 注意 vite 字符串别名只认「全等」或「dir/ 前缀」，故 find 必须带 .vue 全名。
    {
      find: '@/components/panels/Toolbar.vue',
      replacement: `${appSrc}/components/panels/Toolbar.vue`,
    },
    {
      find: '@/components/layout/AppStatusBar.vue',
      replacement: `${appSrc}/components/layout/AppStatusBar.vue`,
    },
    { find: '@/components', replacement: pkg('ui/src/components') },
    { find: '@/views', replacement: pkg('ui/src/views') },
    { find: '@/styles', replacement: pkg('ui/src/styles') },
    // —— 兜底：app 自己的 src ——
    { find: '@/', replacement: `${appSrc}/` },
  ];
}
