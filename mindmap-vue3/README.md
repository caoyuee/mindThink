# DesktopNaotu Web

> 桌面版脑图 · 现代 Web 客户端
>
> 基于 Vue 3 + markmap · TypeScript · 4 语言 · 命令栈撤销/重做
>
> 远期规划: Tauri 桌面壳 · MCP/AI 集成 · 插件系统

---

## 1. 项目简介

**DesktopNaotu Web** 是 [DesktopNaotu](https://github.com/NaoTu/DesktopNaotu)
的现代化重构版本。原始项目基于 Electron + AngularJS 1.x +
kityminder（旧百度脑图内核），本次重构：

- 前端框架: AngularJS 1.x → Vue 3（Composition API + `<script setup>`）
- 脑图渲染: kityminder-editor → markmap（轻量、Markdown 原生）
- 桌面壳: Electron → Tauri 2.x（下一阶段）
- 工程化: gulp 3 + Bower → Vite 6 + pnpm + ESLint + Prettier + Vitest
- 包管理: Bower → npm（移除 bower 依赖）
- 新增: MCP/AI 集成、移动端适配

本目录是 **Web 端** 实现，桌面壳（Tauri）将在后续阶段补齐。

## 2. 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev               # http://localhost:5180

# 运行测试
pnpm test

# 构建生产版本
pnpm build

# 验证（提交前必跑）
pnpm verify            # typecheck + lint + format + test
```

需要 Node ≥ 22 和 pnpm ≥ 9。

## 3. 项目规则与质量门禁

### 必读文档

| 文档                               | 何时读                           |
| ---------------------------------- | -------------------------------- |
| [AGENTS.md](AGENTS.md)             | 修改任何代码前（红线与分层约束） |
| [CONVENTIONS.md](CONVENTIONS.md)   | 写新代码前                       |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 修改跨模块代码前                 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 提交 PR 前                       |

### 质量门禁

```bash
pnpm typecheck       # vue-tsc 类型检查
pnpm lint            # ESLint（含红线规则化）
pnpm format          # Prettier 自动修复
pnpm format:check    # Prettier 检查
pnpm test            # Vitest 单元测试
pnpm verify          # 上述四项合并
```

**当前状态**: ✅ typecheck=0 · lint=0 · format=0 · test=14 passing

## 4. 工程结构

```
spike/mindmap-vue3/
├── src/
│   ├── views/               # 路由级页面
│   │   ├── EditorView.vue
│   │   ├── SettingsView.vue
│   │   ├── AboutView.vue
│   │   └── NotFoundView.vue
│   ├── components/
│   │   ├── layout/          # 顶栏、底栏
│   │   ├── editor/          # markmap 集成
│   │   ├── panels/          # 工具栏、侧栏
│   │   ├── dialogs/         # 模态对话框（待补）
│   │   └── common/          # Toast 等原子组件
│   ├── stores/              # Pinia stores
│   │   ├── mindmap.ts       # 脑图状态 + 命令栈
│   │   ├── ui.ts            # 主题
│   │   └── config.ts        # 用户配置（持久化）
│   ├── composables/         # 可复用 hook
│   │   ├── useShortcuts.ts
│   │   ├── useToast.ts
│   │   └── useErrorHandler.ts
│   ├── core/                # 纯函数核心（无 Vue 依赖）
│   │   ├── tree.ts
│   │   ├── commands.ts
│   │   ├── file.ts
│   │   └── logger.ts
│   ├── i18n/                # 国际化
│   │   ├── index.ts
│   │   └── locales/         # zh-CN / en / zh-TW / de
│   ├── router/              # vue-router 配置
│   ├── types/               # 类型定义
│   ├── tests/               # Vitest 单元测试
│   ├── styles/              # 全局样式 + CSS 变量
│   ├── App.vue              # 应用根
│   └── main.ts              # 入口
├── public/
├── .github/workflows/       # CI
├── eslint.config.js         # ESLint 9 flat config
├── vitest.config.ts
├── vite.config.ts
├── tsconfig.json
├── .prettierrc.json
├── .editorconfig
└── package.json
```

## 5. 关键技术决策

### 5.1 与 markmap 的桥接

- `MindNode` 内部持有稳定 `id`（nanoid），与 markmap 解耦
- 渲染时转换为 markmap `IPureNode`，通过 `payload.id` 携带稳定标识
- 撤销/重做靠 id 定位节点，markmap 重建不影响栈

### 5.2 命令栈（撤销/重做）

- 快照式（非 diff），简单可靠
- 100 操作上限（防止内存爆炸）
- 命令对象纯数据可序列化，便于 AI 回放

### 5.3 i18n

- 4 语言：zh-CN（默认）、en、zh-TW、de
- 自动检测浏览器语言，用户可在设置切换
- 持久化到 localStorage

### 5.4 文件 IO

- 浏览器: File System Access API + `<a download>` 回退
- 桌面端（Tauri 阶段）: `invoke('save_file')` / `invoke('read_file')`
- 所有 IO 集中到 `core/file.ts`

## 6. 命令行

| 命令                 | 作用                             |
| -------------------- | -------------------------------- |
| `pnpm dev`           | 启动 dev server（端口 5180）     |
| `pnpm build`         | 生产构建                         |
| `pnpm preview`       | 预览生产构建                     |
| `pnpm typecheck`     | vue-tsc 类型检查                 |
| `pnpm lint`          | ESLint                           |
| `pnpm lint:fix`      | ESLint 自动修复                  |
| `pnpm format`        | Prettier 自动格式化              |
| `pnpm format:check`  | Prettier 检查                    |
| `pnpm test`          | Vitest 单元测试（单次）          |
| `pnpm test:watch`    | Vitest 监听模式                  |
| `pnpm test:coverage` | Vitest + coverage                |
| `pnpm verify`        | typecheck + lint + format + test |

## 7. 路线图

- [x] spike: Vue3 + markmap 可行性验证
- [x] 正式工程骨架（路由、store、i18n、测试、CI）
- [ ] 节点真拖拽（d3-drag 集成 markmap）
- [ ] 节点大纲模式（左侧导航）
- [ ] 多主题与图标
- [ ] PNG/SVG 导出
- [ ] Tauri 2.x 桌面壳
- [ ] MCP Server（外部 Agent 接入）
- [ ] 内置 AI 对话面板
- [ ] 自动更新

## 8. 文档索引

- [AGENTS.md](AGENTS.md) — AI Agent 规则
- [CONVENTIONS.md](CONVENTIONS.md) — 代码风格
- [ARCHITECTURE.md](ARCHITECTURE.md) — 架构总览
- [CONTRIBUTING.md](CONTRIBUTING.md) — 贡献指南
- [CHANGELOG.md](CHANGELOG.md) — 变更日志

## 9. 许可

[GPL-2.0](../LICENSE)
