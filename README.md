# mindThink · 工程总览

> AI 原生的本地优先思维导图工作台 —— **人用它思考，Agent 用它干活。**

mindThink 是原 DesktopNaotu（桌面版脑图）的现代化重构项目。新定位：既是人的思考界面，也是 AI Agent 的操作对象——通过 **MCP 双向**（既是 Server 让 Claude/Cursor 读写你的脑图，也是 Client 让内置 AI 调用外部工具），以及**一切写入走同一条命令栈**的安全模型，在同类工具中建立差异化护城河。

## 核心定位

| 支柱 | 说明 |
|---|---|
| 开放纯文本 | 文档对人和 AI 都可读可写（Markdown 作为交换层） |
| AI 直接编辑 | AI 不再只写备注，而是输出结构化节点操作（ops），经 diff 预览后走命令栈落盘 |
| MCP 双向 | Server：让外部 Agent 读写脑图；Client：让内置 AI 调用外部工具 |

## 技术栈

| 层 | 技术 |
|---|---|
| Web 前端 | Vue 3.5 + Pinia + Vite 6 + TypeScript strict |
| 桌面壳 | Tauri 2.x（Rust 后端，安装包 <25MB） |
| 脑图内核 | markmap 0.18（现状）→ **simple-mind-map**（规划，见 docs/decisions.md D1） |
| 测试/质量 | Vitest + ESLint 9 + Prettier 3 + CI（pnpm workspace monorepo） |
| i18n | vue-i18n，4 语言（zh-CN / en / zh-TW / de） |

## 目录结构

```
mindThink/                     pnpm workspace monorepo（D3）
├── README.md                  本文件（项目总入口）
├── AGENTS.md                  统一开发规则（所有 AI Agent 必读）
├── ROADMAP-2026-11-07.md      开发方向总体规划（六决策 + 六里程碑）
├── docs/                      架构 / 决策 / 路线图 / 归档
├── apps/
│   ├── web/                   Web 端（FS Access，迭代基线）
│   └── desktop/               桌面端（Tauri 2.x 发布目标，src-tauri/ Rust）
├── packages/
│   ├── core/                  纯 TS 核心层（core 算法 + platform + types）
│   ├── ui/                    共享 UI（组件 / 视图 / composables / router / styles）
│   └── i18n/                  i18n 装配逻辑（locales 文案属平台分歧，留各 app）
├── build/aliases.ts           `@/` 别名单一事实源（两 app 共用）
└── legacy/                    原 Electron + kityminder 项目存档（只读参考）
```

| 路径 | 用途 | 状态 |
|---|---|---|
| `apps/web/` | Web 端 | 0.1.0 alpha |
| `apps/desktop/` | 桌面端 | 0.1.0 alpha（前端完整 / cargo 已部分验证） |
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
| 3 | `ROADMAP-2026-11-07.md` | 了解全局方向与待确认决策 |
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

| 里程碑 | 版本 | 主题 |
|---|---|---|
| M0 | v0.2 | 工程收口（备份策略 / Recent 子菜单 / defSavePath / monorepo） |
| M1 | v0.3 | 内核升级 simple-mind-map + 设计系统 |
| M2 | v0.4 | AI 结构化编辑（ops + diff 预览 + 成组撤销） |
| M3 | v0.5 | MCP Server 实时桥接 + 鉴权 |
| M4 | v0.6 | MCP Client + Agent 会话 |
| M5 | v1.0 | 发布工程（签名 / 更新 / 三平台 CI） |

详见 `docs/roadmap.md`。

## 许可

[GPL-2.0](LICENSE)
