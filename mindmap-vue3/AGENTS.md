# AGENTS.md — 面向 AI Agent 的项目规则

> 本文件为 AI 编程助手（Claude、GPT、Cursor、Trae 等）提供项目协作规范。
> 修改本项目前请通读一遍。
>
> 文档变更需经过一次 PR review；任何对"红线"或"分层"的修改需在对话中说明理由。

## 0. 项目背景

- **名称**: DesktopNaotu Web
- **版本**: 0.1.0（alpha）
- **目标**: 基于 Vue 3 + markmap 的现代化脑图应用，远期集成 Tauri 桌面壳与 MCP/AI
- **技术栈**:
  - Vue 3.5 + `<script setup>` Composition API
  - TypeScript 5.6（strict）
  - Vite 6（dev/build）+ Vitest 2（test）
  - Pinia 2（state）
  - vue-router 4（routing）
  - vue-i18n 10（4 语言: zh-CN, en, zh-TW, de）
  - markmap 0.18（脑图渲染核心）
  - ESLint 9 + Prettier 3（代码质量）

## 1. 绝对红线（违反即拒绝合并）

1. **禁止在 webview 渲染层使用 Node API**：
   - ❌ `fs`, `path`, `child_process`, `Buffer`, `process.argv`
   - ❌ `require()` 直接引入 Node 内置模块
   - ❌ 顶层调用 `window.xxx =` 污染全局
   - ✅ 文件 IO 走 `core/file.ts`（封装 FS Access API 或后续的 Tauri invoke）
2. **禁止修改 `src/types/markmap.d.ts` 之外的 markmap 类型封装**：所有 markmap 类型必须经 `src/types/markmap.d.ts` 单点收口
3. **禁止在非 store 模块直接调用 `Markmap.create()` / `mm.setData()`**：markmap 集成只允许在 `components/editor/MindEditor.vue`
4. **禁止直接修改 `doc.value`**：所有修改必须经 `stores/mindmap.ts` 的 actions（保证撤销/重做栈一致）
5. **禁止在 `core/` 下写 Vue 组件**：核心层保持纯 TS，可独立测试
6. **禁止静默吞错误**：`catch (e) {}` 一律报错。所有错误用 `logger.error()`，用户可见错误用 toast 提示
7. **禁止 `alert()` / `confirm()`**：用 `bootbox` 或自定义 UI 组件（spike 阶段暂用 `window.prompt/confirm`，将在 dialogs/ 目录下替换）
8. **禁止跳过测试**：所有新增的 `core/` 工具函数必须配套至少一个单元测试

## 2. 架构分层（强制）

```
┌──────────────────────────────────────────────────┐
│ Views (src/views/*.vue)                          │  ← 路由级页面
├──────────────────────────────────────────────────┤
│ Components                                       │
│ ├─ layout/    顶栏/底栏/AppShell 组件            │
│ ├─ editor/    markmap 集成                       │
│ ├─ panels/    侧栏/工具栏                        │
│ ├─ dialogs/   模态对话框                         │
│ └─ common/    Toast/Button 等原子组件             │
├──────────────────────────────────────────────────┤
│ Stores (src/stores/*.ts)                         │  ← 状态、命令栈、对外 actions
├──────────────────────────────────────────────────┤
│ Composables (src/composables/*.ts)               │  ← 复用 hook（i18n/快捷键/toast）
├──────────────────────────────────────────────────┤
│ Core (src/core/*.ts)                             │  ← 纯函数, 无副作用, 可测试
├──────────────────────────────────────────────────┤
│ Types (src/types/*.ts)                           │  ← 类型定义, 不放实现
└──────────────────────────────────────────────────┘
```

**依赖方向**: 上层可调下层，下层不可调上层。

- `views` 可调 `components`、`stores`、`composables`、`core`、`types`
- `components` 可调 `stores`、`composables`、`core`、`types`
- `composables` 可调 `stores`、`core`、`types`
- `stores` 可调 `core`、`types`
- `core` 只可调 `types`
- `types` 不调任何

## 3. 修改决策树（遇到任何修改前先回答）

| 场景 | 落点 |
|---|---|
| 新增脑图节点操作（增删改） | `stores/mindmap.ts` 的 actions |
| 新增树形算法（找路径、遍历） | `core/tree.ts` |
| 新增命令（一种新的可撤销操作） | `core/commands.ts` |
| 新增文件 IO 能力（导出 PNG、JSON） | `core/file.ts` |
| 新增 UI 控件 | `components/{layout,editor,panels,dialogs,common}/` |
| 新增路由页面 | `views/<Name>.vue` + `router/index.ts` |
| 新增全局 hook（快捷键、toast） | `composables/` |
| 新增类型/接口 | `types/` 下，按域拆分 |
| 修改 markmap 集成 | **只改 `components/editor/MindEditor.vue`** |
| 修改主题颜色/间距 | 只改 `styles/global.css` 的 CSS 变量 |
| 翻译文本 | `i18n/locales/*.json` |

## 5. 国际化（i18n）

- **已集成 vue-i18n**
- 用户可见字符串用 `useI18n()` 的 `t()` 函数（Composition API）或 `$t`（Options API）
- key 用驼峰命名，按域分组：`common.ok`、`toolbar.open`、`node.addChild`
- 4 语言: zh-CN, en, zh-TW, de
- 翻译缺失时使用 fallbackLocale (zh-CN) 的值
- **不允许在模板/脚本中硬编码用户可见字符串**

## 6. AI/Agent 协作规范

- **多 Agent 分工时**，每个 agent 修改前先 `git pull` 拉取最新
- **改动大于 200 行**必须先在对话中给出方案，等待用户确认
- **改动跨模块**（涉及 `core/` 或 `stores/`）必须先在对话中说明影响范围
- **不允许跳过质量门禁**：每次提交前必须 `pnpm verify` 通过（typecheck + lint + format + test）
- **不允许提交 `node_modules/`、`dist/`、`*.log`、`*.local`、`coverage/`**
- **命令栈命令名**必须用 i18n key（如 `command.addChild`），不写中文硬编码

## 7. 与后续 Tauri 迁移的兼容

`core/file.ts` 当前的实现是浏览器专用，**Tauri 阶段会整体替换为 `invoke()` 调用**。为此：

- 所有文件 IO 调用必须经过 `core/file.ts`，禁止在组件或 store 中直接 `fs.readFile`
- 类型签名保持 `Promise<T>`，Tauri 改造时不影响调用方
- 当前 store 的 `markmap: shallowRef` 字段在 Tauri 阶段会被移除（markmap 渲染不需要跨 IPC）

## 8. 与后续 MCP/AI 集成的兼容

- 树结构 `MindNode` 的 `meta` 字段是 AI 写入自定义数据的预留位
- `core/commands.ts` 命令栈未来需要被 AI 操作回放——保持命令对象**纯数据可序列化**（不持闭包）
- `stores/mindmap.ts` 所有 actions 都接受纯数据参数（id、text 等），便于从外部驱动

## 9. 调试规范

- 所有错误用 `logger.error()` 或 `console.error()`，**禁止静默 `catch {}`**
- 用户可见的错误用 `useToastStore().error()` 或 UI 提示，**禁止 `alert()` / `confirm()`**
- 调试用的 `console.log` 必须有 `// DEBUG: <原因>` 注释，否则 ESLint 报警告

## 10. 协作入口清单

| 文件 | 何时读 |
|---|---|
| `README.md` | 第一次接触项目 |
| `AGENTS.md`（本文件） | 修改任何代码前 |
| `CONVENTIONS.md` | 写新代码前 |
| `ARCHITECTURE.md` | 修改跨模块代码前 |
| `package.json` scripts | 跑命令前 |

## 11. 提交前自查清单

```bash
pnpm typecheck       # 必过
pnpm lint            # 必过
pnpm format:check    # 必过
pnpm test            # 必过
# 等价命令：
pnpm verify
```

任何一项失败都不能合并。