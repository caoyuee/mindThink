# AGENTS.md — 面向 AI Agent 的统一项目规则

> 本文件是 mindThink 全项目的开发规则基线，所有 AI 编程助手（Claude、GPT、Cursor、Trae 等）修改任何代码前必须通读。
> 工程为 **pnpm workspace monorepo**（D3）：`apps/web`（Web）、`apps/desktop`（Tauri 桌面）两个 app，
> 共享源码物理单份放 `packages/{core,ui,i18n}`，经 `build/aliases.ts` 的 `@/` 别名缝合；
> 各 app 仅补充平台特定规则（见各自 AGENTS.md）。
> 对「红线」或「分层」的修改必须先在对话中说明理由。

## 0. 项目背景

- **名称**：mindThink（原 DesktopNaotu 重构）
- **定位**：AI 原生的本地优先思维导图工作台（人用它思考，Agent 用它干活）
- **技术栈**：
  - 前端：Vue 3.5 + `<script setup>` + TypeScript 5.6（strict）+ Vite 6 + Pinia 2 + vue-router 4
  - i18n：vue-i18n 10，4 语言（zh-CN / en / zh-TW / de）
  - 脑图内核：markmap 0.18（现状）→ simple-mind-map（规划，见 docs/decisions.md D1）
  - 桌面：Tauri 2.x + Rust 1.77+
  - 质量：Vitest 2 + ESLint 9 + Prettier 3
- **权威文档**：`ROADMAP-2026-11-07.md`（总方向）、`docs/decisions.md`（架构决策）、`docs/architecture.md`（目标架构）

## 1. 绝对红线（违反即拒绝合并）

### 1.1 数据完整性红线

1. **一切写入走命令栈**：文档（`doc.value`）的任何修改——包括用户编辑、内置 AI 写入、MCP 外部 Agent 写入——都必须经 `stores/mindmap.ts` 的 actions 和 `applyEdit()`，保证撤销/重做栈一致。**禁止任何入口绕过命令栈直接改树**。
2. **`doc.value` 只能由 store 内 `_replaceDoc()` 直接替换**。
3. **命令对象保持纯数据可序列化**（不持闭包），AI/MCP 操作回放依赖此性质。

### 1.2 架构分层红线

4. **禁止在 `core/` 下写 Vue 组件**：核心层（`packages/core`）保持纯 TS，零 Vue 依赖，可独立测试。
5. **脑图内核集成必须收口**：
   - 现状（markmap）：类型只经 `packages/core/src/types/markmap.d.ts`；`Markmap.create()`/`mm.setData()` 只允许在 `packages/ui/src/components/editor/MindEditor.vue`。
   - 规划（simple-mind-map）：新增 `packages/core/src/core/renderer-bridge.ts` 适配层，内核只能出现在 `MindEditor.vue` + renderer-bridge 两处。
6. **文件 IO 只经 `core/file.ts`**（各 app 的平台分歧实现）：禁止组件/store 直接 `fs`/`invoke`；类型签名保持 `Promise<T>`，Web（FS Access）/ Tauri（invoke）实现可替换。

### 1.3 安全与健壮性红线

7. **禁止在 webview 渲染层使用 Node API**：`fs`/`path`/`child_process`/`Buffer`/`process.argv`/`require()` 一律禁止。
8. **禁止静默吞错误**：`catch (e) {}` 一律报错；错误用 `logger.error()`，用户可见错误用 toast。
9. **禁止 `alert()`/`confirm()`/`window.prompt`**：用 `components/dialogs/` + `useDialog()`。
10. **API key 不得落盘为明文**：不得写入 config JSON、日志、MCP context；桌面端远期迁 OS keyring（见 docs/decisions.md D4 相关 C2）。
11. **MCP 写操作必须走 ops 校验 + diff 批准**（见 docs/decisions.md D5）：外部写链路默认 fail-closed。

### 1.4 Tauri 特定红线（apps/desktop/src-tauri/ 内）

12. **Rust 命令必须 `async` + 返回 `AppResult<T>`**，禁止 `unwrap()`/`expect()` 于生产路径。
13. **新增 Tauri 命令三件套**：`commands.rs` 定义 → `lib.rs` 的 `generate_handler![]` 注册 → `capabilities/default.json` 加权限（如需要）。
14. **调用 Tauri 命令前先 `isTauri()` 检测**。

## 2. 架构分层（强制）

分层在 monorepo 下的物理落点：**共享层在 `packages/`，平台分歧层在各 app 的 `src/`**。

```
┌────────────────────────────────────────────────────────────┐
│ 各 app src/（平台分歧）：App.vue / main.ts / core/file.ts    │
│   / stores/{config,mindmap}.ts / i18n/locales / tests       │
├────────────────────────────────────────────────────────────┤
│ packages/ui  Views/Components/Composables/router/ui store   │  ← 共享
├────────────────────────────────────────────────────────────┤
│ packages/core  Core（core/*.ts + platform.ts）              │  ← 共享，纯 TS 零 Vue
├────────────────────────────────────────────────────────────┤
│ packages/core/src/types  类型定义，不放实现                   │  ← 最底层
└────────────────────────────────────────────────────────────┘
```

**依赖方向**：上层可调下层，下层不可调上层。
`views → components → (stores, composables) → core → types`；`core` 只可调 `types`；`types` 不调任何。
已知例外（经别名缝合，为现状接受）：packages/ui 内组件通过 `@/` 引用各 app 的
`stores/mindmap`、`stores/config`、`core/file`（平台分歧层）——升级为严格包边界
（注册式注入）是后续重构项，新增代码不要扩大此类反向依赖。

## 3. 修改决策树

> 路径规则：跨端共享的落点在 `packages/`，平台分歧的落点在 `apps/<web|desktop>/src/`。

| 场景 | 落点 |
|---|---|
| 新增脑图节点操作（增删改） | `apps/*/src/stores/mindmap.ts` 的 actions（平台分歧，两端分别实现） |
| 新增树形算法（找路径、遍历） | `packages/core/src/core/tree.ts` |
| 新增命令（可撤销操作） | `packages/core/src/core/commands.ts` |
| 新增 AI 结构化操作（op） | `packages/core/src/core/ai-ops.ts`（schema + 校验） |
| 新增文件 IO（导出 PNG/JSON/mmap） | 各 app 的 `src/core/file.ts`（接口共享，实现分歧） |
| 脑图内核数据模型转换 | `packages/core/src/core/renderer-bridge.ts` |
| 新增共享 UI 控件 | `packages/ui/src/components/{layout,editor,panels,dialogs,common}/` |
| 新增路由页面 | `packages/ui/src/views/<Name>.vue` + `packages/ui/src/router/index.ts` |
| 新增全局 hook（共享） | `packages/ui/src/composables/` |
| 新增类型/接口 | `packages/core/src/types/` 下按域拆分 |
| 修改脑图内核集成 | **只改 `MindEditor.vue` + `renderer-bridge.ts`** |
| 修改主题颜色/间距 | 只改 `packages/ui/src/styles/global.css` 的 CSS 变量 |
| 翻译文本 | `apps/*/src/i18n/locales/*.json`（两端文案允许平台差异，同步维护） |
| `@/` 别名规则调整 | 只改 `build/aliases.ts` + 两 app tsconfig paths（保持同构） |

## 4. 国际化（i18n）

- 用户可见字符串用 `useI18n()` 的 `t()`；key 驼峰命名按域分组（`common.ok`、`toolbar.open`、`node.addChild`）。
- 4 语言同步：zh-CN / en / zh-TW / de；翻译缺失回退 zh-CN。
- **不允许硬编码用户可见字符串**。
- 命令栈命令名必须用 i18n key（如 `command.addChild`），不写中文硬编码。

## 5. AI/MCP 协作规范（新规划重点）

- **AI 写入协议**：内置 AI 与 MCP 外部 Agent 统一使用 `MindMapOp` 结构（见 docs/decisions.md D4/D5），**共用一个 ops schema**——这是架构一致性的关键。
- **AI 建议默认预览不落盘**：AI 提出的每组变更先展示 diff（画布高亮 + 侧栏逐条），用户批准后才走命令栈；一个 AI 建议 = 一个可撤销单元。
- **ops 校验失败不落盘**：JSON 解析失败 / ops 校验失败返回用户可读错误。
- **MCP 写操作默认 fail-closed**：外部写需 diff 批准；只读工具可配置自动执行（见 docs/decisions.md D5）。

## 6. 多 Agent 分工规范

- 每个 agent 修改前先 `git pull` 拉最新。
- **改动 >200 行**必须先给方案，等待确认。
- **改动跨模块**（涉及 `core/` 或 `stores/`）必须先说明影响范围。
- **不允许跳过质量门禁**：提交前必须根目录 `pnpm verify` 通过。
- **不允许提交** `node_modules/`、`dist/`、`*.log`、`*.local`、`coverage/`、`src-tauri/target/`。
- **共享代码物理单份**（packages/）：monorepo 后不存在双副本漂移问题；平台分歧文件
  （App.vue / core/file.ts / stores / locales / tests）本就分属各 app，改动无需同步。

## 7. 调试规范

- 错误用 `logger.error()` / `console.error()`，禁止静默 `catch {}`。
- 用户可见错误用 toast，禁止 `alert()`/`confirm()`。
- `console.log` 必须带 `// DEBUG: <原因>` 注释，否则 ESLint 报警告。

## 8. 文档协作入口

| 文件 | 何时读 |
|---|---|
| `README.md` | 第一次接触项目 |
| `AGENTS.md`（本文件） | 修改任何代码前 |
| `ROADMAP-2026-11-07.md` | 了解全局方向 |
| `docs/decisions.md` | 了解架构决策（D1-D6） |
| `docs/architecture.md` | 修改跨模块代码前 |
| `docs/roadmap.md` | 领取开发任务前 |
| `package.json` scripts | 跑命令前 |

## 9. 提交前自查清单

```bash
pnpm typecheck       # 必过（根目录聚合两 app，vue-tsc 连带覆盖全部 packages 源码）
pnpm lint            # 必过（根目录 eslint 一把梭 apps + packages + build）
pnpm format:check    # 必过
pnpm test            # 必过（两 app vitest）
# 等价命令：pnpm verify

# Rust（改动 apps/desktop/src-tauri/ 时）
cd apps/desktop/src-tauri
cargo fmt -- --check && cargo check && cargo test && cargo clippy --all-targets -- -D warnings
```

任何一项失败都不能合并。

## 10. 代码规范与格式化（ESLint × Prettier）

工具链配置（`eslint.config.js`、`.prettierrc.json`、`.prettierignore`、`.editorconfig`）
**只在仓库根一份**（M0-6 起）。monorepo 下共享源码物理单份（`packages/`），
不存在「双副本漂移」，配置与代码都无同步负担。

| 工具 | 职责 |
|---|---|
| ESLint 9（flat config） | 代码质量与红线：`no-restricted-imports`（禁 Node API）、`no-unused-vars`、`consistent-type-imports`、`vue/*` 等 |
| Prettier 3 | 排版：引号、分号、缩进、行宽 100、尾逗号、LF |

**兼容方式**：`eslint-config-prettier` 必须是 `eslint.config.js` 配置数组的**最后一项**，
它关闭全部与 Prettier 冲突的格式规则（`quotes` / `semi` / `indent` / `comma-dangle` /
`vue/html-indent` 等）。刻意不引入 `eslint-plugin-prettier`：这是 Prettier 官方推荐做法，
避免 `eslint --fix` 与 `--write` 互相覆盖，也避免 lint 变慢。
语义规则仍由 ESLint 检查，格式由 `format:check` 独立把关。

**修复顺序**：先 ESLint、后 Prettier——`pnpm fix`（= `pnpm lint:fix && pnpm format`）。
`pnpm verify` 中 `lint` 与 `format:check` 都必须通过。

**覆盖范围**：`apps/**`、`packages/**`、`build/**` 的 `src/**/*.{ts,vue,css,json}`
与根目录 `*.{ts,js,json}`（含 vite/vitest/eslint 配置、package.json、tsconfig.json）。
`.prettierignore` 排除依赖、构建产物、lock、`*.tsbuildinfo`、
Vite 临时配置 `*.timestamp-*.mjs` 与历史 Markdown。
只读存档 `legacy/` 与本地工具目录 `.workbuddy/` 不纳入自动检查。

**换行**：统一 LF（`.editorconfig` + `.prettierrc.json` + `.gitattributes`），
历史 CRLF 存量已一次性迁移完成。新文件由编辑器按 `.editorconfig` 写入 LF。

| 命令 | 作用 |
|---|---|
| `pnpm lint` | 只查代码规范（不查格式） |
| `pnpm lint:fix` | 自动修复代码规范问题 |
| `pnpm format` | 按 Prettier 写入（含统一 LF） |
| `pnpm format:check` | 只查格式，不写文件 |
| `pnpm fix` | 一键：先 lint:fix，再 format |
| `pnpm verify` | 完整门禁：两 app typecheck + lint + format:check + 两 app test |
