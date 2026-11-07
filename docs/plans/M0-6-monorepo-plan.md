# M0-6 实施方案：D3 monorepo 迁移（移动不改逻辑）

> 状态：⏸️ **待用户确认后执行**（改动远超 200 行，按 AGENTS.md §6 先方案后动手）。
> 依据：`docs/roadmap.md` M0-6 规格、`docs/decisions.md` D3、`scripts/check-frontend-parity.mjs` 实测基线。
> 执行约定：**一次大 PR + 全量 verify**；parity 脚本退役；Rust 不动。

## 0. 探索结论摘要（方案的事实基础）

- parity 实测：**共享 59 文件 = 字节一致 37 + 允许分歧 22**；仅 Web 有 1 个文件（`tests/file.spec.ts`），仅 Tauri 有 4 个（`core/tauri-file.ts`、`core/web-file.ts`、`core/document-title.ts`、`tests/document-title.spec.ts`）。
- 全部跨目录引用统一走 `@/` 别名；同目录引用走 `./` 相对路径。这是本方案能"零 import 改写"的关键前提。
- 依赖图关键事实：
  - packages 候选文件中，**共享组件/视图反向依赖各 app 的分歧文件**（如 `MindEditor.vue` → `@/stores/mindmap`（分歧）、`@/core/file`（分歧）），因此严格的 package 边界（包内代码只 import 包）在 M0-6 物理上不可达，必须用"别名缝合"。
  - 自包含性已逐一验证：`stores/ui.ts`（只依赖 pinia/vue）、5 个 composables（vue/pinia/nanoid + `@/core/*`）、`router/index.ts`（vue-router + views）、`platform.ts`（零依赖）、`i18n/index.ts`（只 import 同目录 locales —— 唯一例外，见 §2.4）。
- 两棵树的 `vite.config.ts`/`vitest.config.ts`/`tsconfig.json` 已有差异（端口 5180/5181、`base:'./'`、watch ignore、coverage），合并为一棵树后按 app 保留各自配置即可，无漂移回归。
- `tauri.conf.json` 的 `frontendDist: '../dist'`、`beforeDev/BuildCommand: 'pnpm dev|build'` 都是相对 src-tauri 所在目录的布局 —— 只要整体 `git mv tauri-spike → apps/desktop`，**tauri.conf.json 一行都不用改**（见 §4）。
- 两棵树各有 `pnpm-workspace.yaml`（仅 `allowBuilds: esbuild/vue-demi`），需上收到根。
- `mindmap-vue3/.github/workflows/ci.yml` 在子目录下，GitHub 根本不会执行（工作流只认根 `.github/`）——当前是死配置，迁移时顺手移到根并修正命令。
- eslint 配置未启用 type-aware 规则（只有 `recommended`，`parserOptions.project` 是无效遗留），lint 配置可无痛上收根目录，不必造根 tsconfig。

## 1. 目标目录结构与逐文件映射表

### 1.1 核心策略：整树搬移 + 共享文件抽包

先 `git mv` 整棵树（`mindmap-vue3 → apps/web`、`tauri-spike → apps/desktop`），再从两个 app 的 `src/` 中把字节一致的 36 个文件（37 减 `main.ts`）抽到 `packages/`。这保证：
- `src-tauri/`（含 Cargo.toml、.rs、tauri.conf.json、capabilities、icons）**原样整体搬移，零内容改动**；
- Tauri 相对布局（`../dist`、`pnpm dev`）天然保持有效；
- git 保留 rename 历史。

### 1.2 完整映射表

**A. packages/core（纯 TS，零 Vue 依赖）— 12 文件**

| 现路径（两树同路径） | 新路径 | 分类 |
|---|---|---|
| `*/src/core/ai.ts` | `packages/core/src/core/ai.ts` | 共享一致 |
| `*/src/core/backup.ts` | `packages/core/src/core/backup.ts` | 共享一致 |
| `*/src/core/commands.ts` | `packages/core/src/core/commands.ts` | 共享一致 |
| `*/src/core/km.ts` | `packages/core/src/core/km.ts` | 共享一致 |
| `*/src/core/logger.ts` | `packages/core/src/core/logger.ts` | 共享一致 |
| `*/src/core/log-sink.ts` | `packages/core/src/core/log-sink.ts` | 共享一致 |
| `*/src/core/mcp.ts` | `packages/core/src/core/mcp.ts` | 共享一致 |
| `*/src/core/menu-spec.ts` | `packages/core/src/core/menu-spec.ts` | 共享一致 |
| `*/src/core/shortcuts.ts` | `packages/core/src/core/shortcuts.ts` | 共享一致 |
| `*/src/core/tree.ts` | `packages/core/src/core/tree.ts` | 共享一致 |
| `*/src/platform.ts` | `packages/core/src/platform.ts` | 共享一致（零依赖，放 core 符合"纯 TS"分层） |
| `*/src/types/markmap.d.ts` | `packages/core/src/types/markmap.d.ts` | 共享一致（types 是分层最底层） |

> 包内保留 `core/` 子目录层级，让 `@/core/*` 别名可直接映射 `packages/core/src/core/*`，避免包内相对路径重排。

**B. packages/i18n — 1 文件（含 4 行 import 改写）**

| 现路径 | 新路径 | 分类 |
|---|---|---|
| `*/src/i18n/index.ts` | `packages/i18n/src/index.ts` | 共享一致，**但 4 行 locale import 从 `./locales/x.json` 改为 `@/i18n/locales/x.json`**（唯一源码内容改动，纯路径机制性改写，不改逻辑） |

**C. packages/ui（组件+视图+composables+styles+router+ui store）— 23 文件**

| 现路径（两树同路径） | 新路径 | 分类 |
|---|---|---|
| `*/src/components/common/Toast.vue` | `packages/ui/src/components/common/Toast.vue` | 共享一致 |
| `*/src/components/dialogs/ConfirmDialog.vue` | `packages/ui/src/components/dialogs/ConfirmDialog.vue` | 共享一致 |
| `*/src/components/dialogs/DialogHost.vue` | `packages/ui/src/components/dialogs/DialogHost.vue` | 共享一致 |
| `*/src/components/dialogs/PromptDialog.vue` | `packages/ui/src/components/dialogs/PromptDialog.vue` | 共享一致 |
| `*/src/components/editor/MindEditor.vue` | `packages/ui/src/components/editor/MindEditor.vue` | 共享一致 |
| `*/src/components/editor/NodeContextMenu.vue` | `packages/ui/src/components/editor/NodeContextMenu.vue` | 共享一致 |
| `*/src/components/layout/AppHeader.vue` | `packages/ui/src/components/layout/AppHeader.vue` | 共享一致 |
| `*/src/components/panels/AiAssistant.vue` | `packages/ui/src/components/panels/AiAssistant.vue` | 共享一致 |
| `*/src/components/panels/OutlineTree.vue` | `packages/ui/src/components/panels/OutlineTree.vue` | 共享一致 |
| `*/src/components/panels/Properties.vue` | `packages/ui/src/components/panels/Properties.vue` | 共享一致 |
| `*/src/composables/useDialog.ts` | `packages/ui/src/composables/useDialog.ts` | 共享一致 |
| `*/src/composables/useErrorHandler.ts` | `packages/ui/src/composables/useErrorHandler.ts` | 共享一致 |
| `*/src/composables/useSearchFocus.ts` | `packages/ui/src/composables/useSearchFocus.ts` | 共享一致 |
| `*/src/composables/useShortcuts.ts` | `packages/ui/src/composables/useShortcuts.ts` | 共享一致 |
| `*/src/composables/useToast.ts` | `packages/ui/src/composables/useToast.ts` | 共享一致 |
| `*/src/stores/ui.ts` | `packages/ui/src/stores/ui.ts` | 共享一致（只依赖 pinia/vue，已验证自包含） |
| `*/src/styles/global.css` | `packages/ui/src/styles/global.css` | 共享一致 |
| `*/src/views/AboutView.vue` | `packages/ui/src/views/AboutView.vue` | 共享一致 |
| `*/src/views/EditorView.vue` | `packages/ui/src/views/EditorView.vue` | 共享一致 |
| `*/src/views/NotFoundView.vue` | `packages/ui/src/views/NotFoundView.vue` | 共享一致 |
| `*/src/views/SettingsView.vue` | `packages/ui/src/views/SettingsView.vue` | 共享一致 |
| `*/src/views/ShortcutsView.vue` | `packages/ui/src/views/ShortcutsView.vue` | 共享一致 |
| `*/src/router/index.ts` | `packages/ui/src/router/index.ts` | 共享一致（只 import vue-router + views） |

**D. apps/web（`mindmap-vue3/` 整体 → `apps/web/`）**

| 现路径 | 新路径 | 分类 |
|---|---|---|
| `mindmap-vue3/src/App.vue` | `apps/web/src/App.vue` | 分歧（Web FS Access 壳） |
| `mindmap-vue3/src/env.d.ts` | `apps/web/src/env.d.ts` | 分歧 |
| `mindmap-vue3/src/main.ts` | `apps/web/src/main.ts` | 共享一致但**每 app 一份**（`./App.vue` 相对引用 app 壳），4 行 import 改写为 `@/` 前缀，见 §2.4 |
| `mindmap-vue3/src/core/file.ts` | `apps/web/src/core/file.ts` | 分歧（FS Access 实现） |
| `mindmap-vue3/src/stores/config.ts` | `apps/web/src/stores/config.ts` | 分歧 |
| `mindmap-vue3/src/stores/mindmap.ts` | `apps/web/src/stores/mindmap.ts` | 分歧 |
| `mindmap-vue3/src/i18n/locales/{de,en,zh-CN,zh-TW}.json` | `apps/web/src/i18n/locales/*` | 分歧（4 文件） |
| `mindmap-vue3/src/tests/*.spec.ts`（12 个，含仅 Web 的 `file.spec.ts`） | `apps/web/src/tests/*` | 分歧目录（tests/ 整体归 app） |
| `mindmap-vue3/index.html` | `apps/web/index.html` | 分歧（title 不同） |
| `mindmap-vue3/{package.json,vite.config.ts,vitest.config.ts,tsconfig.json}` | 同名 | 各 app 配置（内容需改，见 §3） |
| 其余 md 文档 / .editorconfig / .gitignore / .prettierrc.json / .prettierignore / eslint.config.js / pnpm-workspace.yaml / pnpm-lock.yaml | 随树搬移；其中 eslint/prettier/editorconfig/pnpm-workspace **上收根目录后删除**；lockfile 删除重建 | — |
| `mindmap-vue3/.github/workflows/ci.yml` | **上移到根 `.github/workflows/ci.yml`** 并改命令（现在是死配置） | — |

**E. apps/desktop（`tauri-spike/` 整体 → `apps/desktop/`）**

| 现路径 | 新路径 | 分类 |
|---|---|---|
| `tauri-spike/src-tauri/**`（.rs、Cargo.toml、Cargo.lock、tauri.conf.json、capabilities、icons、build.rs、gen、target） | `apps/desktop/src-tauri/**` | **Rust 不动：零内容改动**（target/ 未被 git 跟踪，可手动搬或让 cargo 重建） |
| `tauri-spike/src/App.vue`、`env.d.ts`、`main.ts`、`core/file.ts`、`stores/config.ts`、`stores/mindmap.ts` | `apps/desktop/src/...` 同名 | 分歧 |
| `tauri-spike/src/core/{tauri-file,web-file,document-title}.ts` | `apps/desktop/src/core/...` | 仅 Tauri |
| `tauri-spike/src/i18n/locales/*.json`（4） | `apps/desktop/src/i18n/locales/*` | 分歧 |
| `tauri-spike/src/tests/*.spec.ts`（12，含仅 Tauri 的 `document-title.spec.ts`） | `apps/desktop/src/tests/*` | 分歧目录 |
| `tauri-spike/index.html`、4 个工程配置文件 | 同 web 模式 | — |
| `tauri-spike/scripts/gen-icons.mjs`、`tauri-spike/docs/`、各 md 文档 | 随树搬移，原样 | — |

**F. 删除项**：`scripts/check-frontend-parity.mjs`（退役，见 §5）、两棵树内被上收的重复工具链配置、两份旧 `pnpm-lock.yaml`。

### 1.3 包划分理由

- **core → packages/core**：AGENTS 分层红线本就规定 core 纯 TS 零 Vue 依赖、只可调 types；`platform.ts`/`types/` 同为无 Vue 依赖的最底层，顺势收编。10 个 core 文件字节一致，是 drift 事故高发区（算法/命令栈），物理单份收益最大。
- **components/views/composables/styles/router/stores-ui → packages/ui**：全部字节一致且互相引用封闭（同目录相对引用），只通过 `@/` 引用 core（→包）与 stores/config/mindmap、core/file（→app，经别名缝合）。D3 决策原文即此划分。
- **i18n/index.ts → packages/i18n；locales 留各 app**：locales 是真实的平台内容分歧（22 个分歧文件的一部分），强行合一必然改内容违反纪律；index.ts 是纯逻辑单份收拢。这是"逻辑一份、内容两份"的唯一干净切法。
- **App.vue / env.d.ts / main.ts / core/file.ts / stores/config|mindmap / tests → 各 app**：parity EXCLUDED 清单原样对应；`main.ts` 虽字节一致但含 `./App.vue` 相对引用（app 壳入口），强行共享需引入注册机制 = 改逻辑，故接受 2 份副本（约 19 行引导代码，drift 面积极小）。
- **tests 全部留 app**：`menu-spec.spec.ts` 用 `../i18n/locales` 相对引用、`mindmap-store.spec.ts` 测分歧 store，测试契约本就是 per-platform suite；app 的 vitest include 无需改动即可跑通。后续可再把 7 个纯 core 测试晋升进 `packages/core`（独立小任务，不在本 PR）。

### 1.4 构建方式选型：源码直引 + 别名缝合（推荐） vs workspace 协议

| 维度 | A. 源码直引（推荐） | B. workspace 协议（`@mindthink/*`） |
|---|---|---|
| import 改写量 | **0 行** | 约 200+ 行全改 `@mindthink/*` |
| 是否违反"不改逻辑" | 否（配置层解析） | 边缘（机械改写但 PR diff 爆炸） |
| 包边界纯度 | 含已知"ui → app stores"反向引用（现状即如此） | 同样无解（MindEditor 依赖分歧 store） |
| Vue SFC 构建链 | 无需包构建（plugin-vue 转译模块图内任意 .vue） | 需给 ui 包配 exports/构建，复杂度高 |
| 前瞻性 | M1+ 可平滑升级为 workspace 协议 | 一步到位但本次风险大 |

**推荐 A**。D3 的长期目标（物理单份、消除手工同步）A 已 100% 达成。每个 package 仍配最小 `package.json`（仅 name/private 元数据），满足 workspace glob 且为将来升级留锚点。

## 2. pnpm workspace 与根配置

### 2.1 根 `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'

allowBuilds:
  esbuild: true
  vue-demi: true
```
（`allowBuilds` 原样上收自两树现有文件，两树的 `pnpm-workspace.yaml` 删除。）

### 2.2 根 `package.json`（新建）

```jsonc
{
  "name": "mindthink",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9",   // 与 CI 的 pnpm/action-setup version 9 对齐
  "scripts": {
    "dev:web": "pnpm --filter desktop-naotu-web dev",
    "dev:desktop": "pnpm --filter desktop-naotu dev",
    "build": "pnpm -r --if-present build",
    "build:tauri": "pnpm --filter desktop-naotu build:tauri",
    "typecheck": "pnpm -r --if-present typecheck",
    "test": "pnpm -r --if-present test",
    "lint": "eslint apps packages",
    "lint:fix": "eslint apps packages --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "fix": "pnpm lint:fix && pnpm format",
    "verify": "pnpm typecheck && pnpm lint && pnpm format:check && pnpm test"
  }
}
```

设计要点：
- **verify 聚合** = 两 app typecheck（各自 vue-tsc 连带 typecheck 全部 packages 源码）+ 根级 lint（eslint 一把梭 apps+packages）+ 根级 format:check + 两 app vitest。parity 步骤彻底消失。
- **lint/prettier 上收根目录**：两份字节一致的 `eslint.config.js`/`.prettierrc.json`/`.prettierignore`/`.editorconfig` 移到根只留一份。根 eslint `ignores` 增加 `'**/node_modules/**'`、`'**/dist/**'`、`'**/src-tauri/**'`、`'legacy/**'`、`'coverage/**'`，并**删除 `parserOptions.project`**。app 内不再保留这四个配置文件。
- eslint/prettier 及插件 devDependencies 移入根；vite/vitest/vue-tsc/typescript/plugin-vue/happy-dom/@vue/test-utils/@vue/tsconfig 留**各 app**（构建链归 app，版本靠单一 lockfile 约束）。
- 包名暂沿用 `desktop-naotu-web`/`desktop-naotu`（tauri.conf.json 的 beforeDevCommand 只依赖目录内 scripts）；重命名 `@mindthink/*` 留后续任务，避免混入无关 diff。

### 2.3 各 app `package.json` 改动

- 删除 `"parity"` script；`"verify"` 改为 `"typecheck && test"`（lint/format 已上收根）。
- `format`/`format:check`/`lint`/`lint:fix`/`fix` scripts 删除。
- 依赖不动（desktop 保留全部 `@tauri-apps/*`）。

### 2.4 仅有的两处源码内容改动（机械性，共 3 文件 10 行）

1. `packages/i18n/src/index.ts`：4 行 locale import `./locales/x.json` → `@/i18n/locales/x.json`。
2. 两份 `main.ts`（各 app 一份）：`./i18n` → `@/i18n`；`./router` → `@/router`；`./composables/useErrorHandler` → `@/composables/useErrorHandler`；`./styles/global.css` → `@/styles/global.css`（`./App.vue` 保持相对引用）。

除此之外 **37 个共享文件全部原字节搬移，0 行改动**。

## 3. tsconfig / vite alias / vitest 具体改动

### 3.1 新建根 `build/aliases.ts`（单一事实源，防两 app 别名漂移）

```ts
import { fileURLToPath, URL } from 'node:url';

// appDirUrl: 调用方 app 的目录 URL（apps/web 或 apps/desktop）
export function buildAliases(appDirUrl: string) {
  const appSrc = fileURLToPath(new URL('./src', appDirUrl));
  const pkg = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, appDirUrl));
  // 顺序即优先级：具体前缀在前，'@/' 兜底最后
  return [
    { find: '@/core/document-title', replacement: `${appSrc}/core/document-title` },
    { find: '@/core/tauri-file',     replacement: `${appSrc}/core/tauri-file` },
    { find: '@/core/web-file',       replacement: `${appSrc}/core/web-file` },
    { find: '@/core/file',           replacement: `${appSrc}/core/file` },
    { find: '@/core',                replacement: pkg('core/src/core') },
    { find: '@/platform',            replacement: pkg('core/src/platform') },
    { find: '@/types',               replacement: pkg('core/src/types') },
    { find: '@/i18n/locales',        replacement: `${appSrc}/i18n/locales` },
    { find: '@/i18n',                replacement: pkg('i18n/src') },
    { find: '@/stores/ui',           replacement: pkg('ui/src/stores/ui') },
    { find: '@/stores',              replacement: `${appSrc}/stores` },
    { find: '@/composables',         replacement: pkg('ui/src/composables') },
    { find: '@/components',          replacement: pkg('ui/src/components') },
    { find: '@/views',               replacement: pkg('ui/src/views') },
    { find: '@/router',              replacement: pkg('ui/src/router') },
    { find: '@/styles',              replacement: pkg('ui/src/styles') },
    { find: '@/',                    replacement: `${appSrc}/` },
  ];
}
```
（vite 的字符串别名只在「完全相等或后随 `/`」时命中，`@/core` 不会误吞 `@/coreX`；web 端引用 desktop-only 条目不会发生，冗余无害、换来两 app 配置同构。）

### 3.2 两 app `vite.config.ts`
`resolve.alias` 改为 `alias: buildAliases(import.meta.url)`（一行），其余 manualChunks/server/base **逐字节保留**。

### 3.3 两 app `vitest.config.ts`
- 同样接入 `buildAliases(import.meta.url)`。
- **web 专属**：`coverage.include` 改为 `['src/stores/mindmap.ts', '../../packages/core/src/**']`（core 实现已不在 app src 下；需跑一次 `pnpm test:coverage` 确认 glob 生效）。
- `test.include: ['src/tests/**/*.spec.ts']` 不变。

### 3.4 两 app `tsconfig.json`（paths 与 vite 别名同构）

```jsonc
{
  // web 保持 extends @vue/tsconfig/tsconfig.dom.json；desktop 保持现有手写 lib/types，均不动
  "compilerOptions": {
    // ...现有项全部保留...
    "baseUrl": ".",
    "paths": {
      "@/core/document-title": ["src/core/document-title.ts"],
      "@/core/tauri-file":     ["src/core/tauri-file.ts"],
      "@/core/web-file":       ["src/core/web-file.ts"],
      "@/core/file":           ["src/core/file.ts"],
      "@/core/*":              ["../../packages/core/src/core/*"],
      "@/platform":            ["../../packages/core/src/platform.ts"],
      "@/types/*":             ["../../packages/core/src/types/*"],
      "@/i18n/locales/*":      ["src/i18n/locales/*"],
      "@/i18n":                ["../../packages/i18n/src/index.ts"],
      "@/stores/ui":           ["../../packages/ui/src/stores/ui.ts"],
      "@/stores/*":            ["src/stores/*"],
      "@/composables/*":       ["../../packages/ui/src/composables/*"],
      "@/components/*":        ["../../packages/ui/src/components/*"],
      "@/views/*":             ["../../packages/ui/src/views/*"],
      "@/router":              ["../../packages/ui/src/router/index.ts"],
      "@/styles/*":            ["../../packages/ui/src/styles/*"],
      "@/*":                   ["src/*"]
    }
  },
  "include": [
    "src/**/*.ts", "src/**/*.vue", "src/**/*.d.ts",
    "../../packages/*/src/**/*.ts",
    "../../packages/*/src/**/*.vue",
    "../../packages/*/src/**/*.d.ts",
    "vite.config.ts", "vitest.config.ts", "../../build/aliases.ts"
  ]
}
```

要点：
- packages 源码通过 `include` 进入每个 app 的 vue-tsc 程序 → **两个 app 各自全量 typecheck 三包**（双重交叉覆盖），packages 无需独立构建链。
- `types/markmap.d.ts`、`env.d.ts` 的 `declare module '*.vue'` 均在程序内，`.vue` 导入类型不回退。
- desktop 的 `tsconfig.tsbuildinfo` 不迁移（gitignore 项，重新生成）。

### 3.5 根 `.gitignore`（合并两树版）

合并内容：`node_modules/`、`.pnpm-store/`、`dist/`、`coverage/`、`*.tsbuildinfo`、`*.log`、`*.local`、`.env*`、IDE/OS 杂项、`**/src-tauri/target/`、`**/src-tauri/gen/`、`**/src-tauri/.cargo/`、`.eslintcache`。app 内 `.gitignore` 删除。

## 4. tauri.conf.json 需要改的字段：**零处**

**本方案下 tauri.conf.json 一行都不需要改，src-tauri 内任何文件零改动。**

理由：整体搬移后 `src-tauri` 与前端工程的**相对布局完全不变**：
- `beforeDevCommand: "pnpm dev"` / `beforeBuildCommand: "pnpm build"` —— Tauri CLI 以 src-tauri 父目录（`apps/desktop/`）为 CWD，该目录恰有 package.json 与同名 scripts ✓
- `devUrl: "http://localhost:5181"` —— vite 端口配置随 `apps/desktop/vite.config.ts` 原样搬移 ✓
- `frontendDist: "../dist"` —— 相对 src-tauri 解析到 `apps/desktop/dist`，即 vite `outDir` ✓

唯一注意点：`target/`（未跟踪）不会随 git mv 走，本机可手动 `mv` 旧 target 省一次全量重编，否则 cargo 自动重建（仅耗时，无正确性问题）。

## 5. parity 脚本退役方案

**本次迁移 PR 内直接删除 `scripts/check-frontend-parity.mjs`，不留观察期。**

1. 观察期反而制造矛盾态——迁移后 parity 立即对 59 文件中的 36 个报"只在单树存在"，为退役脚本续命改造是负收益。
2. 护栏的防护对象（共享文件双份副本的字节漂移）在 monorepo 下**物理消失**：36 个共享文件只剩一份。剩余双份文件（`main.ts`、locales、tests）本就是 parity 的 EXCLUDED 豁免项，退役零防护损失。
3. 残余漂移面 = `main.ts`（19 行引导代码）+ 平台分歧文件（本就该分歧）。防护改为 PR review + 两端 verify 全绿。
4. 连带文档清理（同 PR）：`AGENTS.md` §6"两端同步/pnpm parity 必过"条款、§10"字节一致配置"表述、`docs/roadmap.md` 执行约定第 3 条、`docs/decisions.md` D3 标 ✅、两树 README 中的 parity 引用。

## 6. 执行步骤序列（每步带验证点）

> 前置：`git status` 干净、打 tag `pre-m0-6` 作为回滚锚点（本机）。

| # | 步骤 | 执行方 | 验证点 |
|---|---|---|---|
| 0 | 确认工作区干净，打 tag `pre-m0-6` | 本机 | `git status` clean |
| 1 | `git mv mindmap-vue3 apps/web`；`git mv tauri-spike apps/desktop` | 沙箱 | `git status` 全 rename（R100）；`ls apps/web/src-tauri` 完好 |
| 2 | 建 `packages/{core,ui,i18n}/src/...` 骨架；写三个最小 `package.json` | 沙箱 | 目录树符合 §1.2 |
| 3 | `git mv` 36 个共享文件：app src → packages | 沙箱 | 对应文件 rename；`diff` 确认与搬移前字节一致（CRLF 归一后） |
| 4 | 改写 `packages/i18n/src/index.ts` 4 行；两份 `main.ts` 各 4 行 | 沙箱 | grep 全仓库仅剩这 10 处新引用；无遗漏 `./locales`、`./i18n`、`./router` 相对引用 |
| 5 | 落地根配置：pnpm-workspace.yaml、package.json、build/aliases.ts、根 eslint/prettier/editorconfig/.gitignore | 沙箱 | node `--check` 校验语法；两 app 内旧工具链配置已删 |
| 6 | 改两 app 的 vite/vitest/tsconfig/package.json（§2.3、§3） | 沙箱 | grep 确认 alias 接入、paths 与 §3.4 一致、`parity` script 消失 |
| 7 | 删除 parity 脚本；文档更新（AGENTS.md、roadmap、decisions、README） | 沙箱 | grep 全仓库无 `check-frontend-parity`/`pnpm parity` 残留 |
| 8 | CI 迁移：死配置 → 根 `.github/workflows/ci.yml`，命令改根 verify + 双 app build | 沙箱 | yaml lint |
| 9 | 交付说明：列出本机命令清单 | 沙箱 | — |
| 10 | `pnpm install`（重建单一根 lockfile） | **本机** | 根 lockfile 唯一；`pnpm -r list` 识别三包两 app |
| 11 | 根 `pnpm verify` | **本机** | 全绿；coverage glob 未命中则按 §3.3 微调 |
| 12 | `pnpm build` | **本机** | `apps/web/dist`、`apps/desktop/dist` 生成 |
| 13 | Rust 四件套：`cargo fmt --check && cargo check && cargo test && cargo clippy` | **本机**（apps/desktop/src-tauri） | 全绿 |
| 14 | `pnpm build:tauri` + GUI 冒烟（开图/存图/设置/快捷键/最近文件） | **本机** | 安装包产出、Tauri 窗口加载正常 |
| 15 | 收尾：HANDOFF 文档、roadmap M0-6 标 ✅ | 沙箱 | 文档一致 |

**回滚策略**：全程单分支单 PR；迁移期间零逻辑改动，回滚 = `git revert` 合并提交或 reset 到 `pre-m0-6` tag。Rust target 与 dist 均为未跟踪产物，不参与回滚。

## 7. 风险清单

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| 1 | 别名缝合配置错误（顺序错/前缀误匹配） | 高 | 集中单一 `build/aliases.ts`；具体前缀先于泛化；步骤 5 后加 node 脚本静态断言每条 alias 目标存在；步骤 11/12 暴露 |
| 2 | vue-tsc 对 packages 源码 include 生效问题 | 中 | 双 app include 三包源码形成双重 typecheck 交叉覆盖；先跑 typecheck 再动其他 |
| 3 | vitest coverage 域外 glob 可能不生效 | 低 | 仅 web 有且只影响报告不影响门禁；步骤 11 跑 test:coverage 确认 |
| 4 | `pnpm install` 后 hoist 行为变化引发"模块找不到" | 中 | vite/vitest import 向上查找可命中根 node_modules；如遇 pnpm 严格隔离问题，构建依赖在根 package.json 重复声明（版本对齐） |
| 5 | Tauri beforeDev/BuildCommand CWD 假设错误 | 低 | 相对布局未变，步骤 14 早期可验证；兜底仅 tauri.conf.json 两行命令前缀（允许范围） |
| 6 | i18n/index.ts 与 main.ts import 改写拼写/遗漏 | 低 | 步骤 4 grep 清单机械化验证 |
| 7 | git mv 顺序混乱导致 rename 检测断裂 | 低 | 严格"先整树 mv、再抽文件"两段式，每段后查 R100 |
| 8 | 文档与实际结构脱节 | 中 | 步骤 7 与代码同 PR 更新，grep 验证无残留 |
| 9 | target/ 未随 mv 导致首次构建超长 | 低 | 本机手动搬移 target；纯耗时非正确性 |
| 10 | 新根 CI 首跑挂 | 低 | 原 CI 本就是死配置；迁移后单独修，不阻塞验收 |

## 8. 工作量粗估

| 类别 | 数量 | 说明 |
|---|---|---|
| git mv 共享源文件 | 36（×2 树 rename 记录） | core 12、ui 23、i18n 1 |
| 保留在 app 的源文件 | web 24 / desktop 27 | 分歧 22 + main.ts + 平台专属 |
| **源码内容改动** | **3 文件 / 10 行** | i18n/index.ts 4 行 + 两份 main.ts 各 4 行 |
| 新建配置 | 8 | 根 package.json、pnpm-workspace.yaml、build/aliases.ts、根 eslint/prettier/editorconfig/.gitignore |
| 修改配置 | 10 | 两 app × 4 + 3 个 packages 最小 package.json |
| 删除 | 10+ | parity 脚本、2 份旧 lockfile、2 份旧 workspace、2×4 份工具链配置、app 内 .gitignore |
| 文档改动 | 5 | AGENTS.md、roadmap、decisions、README、HANDOFF |
| 人工执行命令 | 6 条 | pnpm install / verify / build、cargo 四件套、build:tauri、GUI 冒烟 |

代码 diff 主体为 rename（review 用 `git log --follow -M`），真实新增/修改集中在 21 个配置/元数据文件 + 3 个源文件约 300 行；`src-tauri/` diff 为 **0**。
