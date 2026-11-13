# mindThink · 工程总览

> AI 原生的本地优先思维导图工作台 —— **人用它思考，Agent 用它干活。**

mindThink（应用显示名 **灵犀导图**，zh-TW 靈犀導圖 / en、de 为 mindThink）是原 DesktopNaotu（桌面版脑图）的现代化重构项目。定位：既是人的思考界面，也是 AI Agent 的操作对象——当前通过内置 **MCP Server**（让 Claude/Cursor 实时读写脑图，写操作默认 fail-closed 需批准）实现；MCP Client 方向为后续规划。**一切写入（人的操作 / 外部 Agent）都走同一条命令栈**，可撤销、可审计。

> 内置 AI 对话已于 2026-11-10 移除；结构化写入协议由 MCP `apply_ops` 承载。

## 核心定位

| 支柱 | 说明 |
|---|---|
| 开放纯文本 | 文档对人和 AI 都可读可写（Markdown / KM 作为交换层） |
| 结构化写入 | 外部 Agent 输出 `MindMapOp`（`core/ops.ts`），经**批准门控**后走命令栈落盘，一次调用 = 一个撤销单元 |
| MCP Server | 阶段一已落地：loopback HTTP + 轮换 token + 读/写工具；Client 方向为 M4 规划 |

## 技术栈

| 层 | 技术 |
|---|---|
| Web 前端 | Vue 3.5 + Pinia 4 + Vite 8（rolldown）+ TypeScript 6 strict；**单页**（无 vue-router） |
| 桌面壳 | Tauri 2.x（Rust 后端，安装包 <25MB） |
| 脑图内核 | markmap 0.18（现状）→ **simple-mind-map**（规划，见 docs/decisions.md D1） |
| 测试/质量 | pnpm 12 + Vitest 5 + ESLint 9 + Prettier 3 + CI（GitHub Actions，Windows / Linux 出包） |
| i18n | vue-i18n，4 语言（zh-CN / en / zh-TW / de） |

## 目录结构

```
mindThink/                     pnpm workspace monorepo（D3）
├── README.md                  本文件（项目总入口）
├── AGENTS.md                  统一开发规则（所有 AI Agent 必读）
├── ROADMAP-2026-11-07.md      开发方向总纲（历史快照，见文件头校准说明）
├── docs/                      架构 / 决策 / 路线图 / 归档
├── apps/
│   ├── web/                   Web 端（FS Access，迭代基线）
│   └── desktop/               桌面端（Tauri 2.x 发布目标，src-tauri/ Rust）
├── packages/
│   ├── core/                  纯 TS 核心层（core 算法 + platform + types）
│   ├── ui/                    共享 UI（组件 / 弹窗 / composables / styles；单页无 router）
│   └── i18n/                  i18n 装配逻辑（locales 文案属平台分歧，留各 app）
├── build/aliases.ts           `@/` 别名单一事实源（两 app 共用）
└── legacy/                    原 Electron + kityminder 项目存档（只读参考）
```

| 路径 | 用途 | 状态 |
|---|---|---|
| `apps/web/` | Web 端 | 0.1.0（与桌面端共享 core/ui） |
| `apps/desktop/` | 桌面端 | 0.1.0（发布目标；Rust 四件套待本机最终确认） |
| `packages/*` | 跨端共享源码 | 物理单份，漂移问题天然消失 |
| `legacy/` | 原项目存档 | 📦 只读，不再维护 |

## 两个 app 的关系

```
   ┌──────────────────────────────────────────┐
   │  packages/{core,ui,i18n}                 │  ← 共享源码（物理单份）
   └────────────┬────────────────┬────────────┘
                │ 别名缝合        │ 别名缝合
   ┌────────────▼───┐   ┌────────▼───────────┐
   │   apps/web      │   │   apps/desktop      │
   │   (FS Access)   │   │   ├─ 平台分歧适配层  │
   │                 │   │   └─ src-tauri Rust │
   └─────────────────┘   └────────────────────┘
```

> 共享代码通过 `build/aliases.ts` 的 `@/` 别名映射进各 app（源码直引，无包构建链）；
> 平台分歧文件（App.vue / core/file.ts / stores / locales / tests）物理留各 app。

## 文档导航（新开发 AI 必读顺序）

| 顺序 | 文档 | 何时读 |
|---|---|---|
| 1 | `README.md`（本文件） | 第一次接触项目 |
| 2 | `AGENTS.md` | 修改任何代码前 |
| 3 | `ROADMAP-2026-11-07.md` | 了解方向与研究依据（**历史快照**：现状以本文件 + `docs/decisions.md` + `docs/roadmap.md` 为准） |
| 4 | `docs/decisions.md` | 了解已定的架构决策（D1-D6） |
| 5 | `docs/architecture.md` | 修改跨模块代码前 |
| 6 | `docs/roadmap.md` | 领取具体开发任务前 |

## 快速开始

```bash
pnpm install               # 根目录一次安装全部 workspace

# Web 端（纯浏览器）
pnpm dev:web               # http://localhost:5180

# 桌面端
pnpm dev:desktop           # vite + Tauri 窗口
pnpm build:tauri           # 出安装包（本机）；CI 在 push v* tag 时自动出 Windows / Linux 包
```

## 质量门禁

根目录统一执行（任一失败不能合并）：

```bash
pnpm verify   # 两 app typecheck + 根级 lint + format:check + 两 app test
pnpm fix      # 本地一键修复：eslint --fix → prettier --write
```

- **ESLint 9** 管代码规范与红线，**Prettier 3** 管排版；`eslint-config-prettier` 作为配置数组最后一项关闭所有冲突规则，两者不会互相覆盖。
- 工具链配置（`eslint.config.js` / `.prettierrc.json` / `.prettierignore` / `.editorconfig`）只在根目录一份，monorepo 下共享代码物理单份，无同步负担。
- 源码统一 LF；生成物由 `.prettierignore` 排除，`legacy/` 为只读存档不纳入检查。
- 完整规则见 `AGENTS.md` §10。

Rust 侧：

```bash
cd apps/desktop/src-tauri
cargo fmt -- --check && cargo check && cargo test && cargo clippy --all-targets -- -D warnings
```

## 路线图概览

| 里程碑 | 状态 | 主题 |
|---|---|---|
| M0 | ✅ 已随 **v0.1.0** 发布 | 工程收口（备份 / Recent / defSavePath / monorepo / 原生菜单 / 品牌） |
| M3 阶段一 | ✅ 已随 **v0.1.0** 发布 | MCP Server 实时桥接 + 鉴权 + fail-closed 写入（原规划 M3） |
| **M1** | 🔵 **下一里程碑**（2026-11-13 确认启动） | 内核升级 simple-mind-map + 设计系统（D1 / D6 已确认） |
| M2 | ⏸ 前提待重定调 | 内置 AI 已移除；是恢复内置 AI 还是改走纯外部 Agent，待产品决策。ops schema 已由 `core/ops.ts` 落地 |
| M3 余项 / M4 / M5 | 🔵 规划 | 多窗口目标选择 / MCP Client + Agent 会话 / 签名、更新、三平台 CI |

详见 `docs/roadmap.md`。

## 许可

[GPL-2.0](LICENSE)
