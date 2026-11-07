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
| 测试/质量 | Vitest + ESLint 9 + Prettier 3 + parity 护栏 + CI |
| i18n | vue-i18n，4 语言（zh-CN / en / zh-TW / de） |

## 目录结构

```
mindThink/
├── README.md                    本文件（项目总入口）
├── AGENTS.md                    统一开发规则（所有 AI Agent 必读）
├── ROADMAP-2026-11-07.md        开发方向总体规划（六决策 + 六里程碑）
├── docs/
│   ├── architecture.md          目标架构与数据流
│   ├── decisions.md             D1-D6 架构决策记录（ADR）
│   ├── roadmap.md               可派工的路由图（任务级规格）
│   └── archive/                 历史文档（HANDOFF/NEXT-PLAN/CODE_REVIEW 归档）
├── mindmap-vue3/                Web 端（迭代开发主战场）
├── tauri-spike/                 桌面端（Tauri 发布目标）
├── legacy/                      原 Electron + kityminder 项目存档（只读参考）
└── scripts/                     工程脚本（parity 护栏等）
```

| 路径 | 用途 | 状态 |
|---|---|---|
| `mindmap-vue3/` | Web 端 | 0.1.0 alpha |
| `tauri-spike/` | 桌面端 | 0.1.0 alpha（前端完整 / cargo 已部分验证） |
| `legacy/` | 原项目存档 | 📦 只读，不再维护 |

## 两个工程的关系

```
   ┌─────────────────────┐
   │     mindmap-vue3     │   ← 迭代开发主战场（前端能力基线）
   └──────────┬──────────┘
              │ 源码复制（手工同步 + parity 护栏校验）
              ▼
   ┌─────────────────────┐
   │     tauri-spike      │   ← 发布目标
   │     ├─ Rust 后端     │
   │     └─ 前端 + 适配   │
   └─────────────────────┘
```

> ⚠️ 当前为**双工程手工同步**，靠 `scripts/check-frontend-parity.mjs` 护栏防漂移。
> 规划已决定合并为 **pnpm workspace monorepo**（见 docs/decisions.md D3），届时此结构作废。

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
# Web 端（纯浏览器）
cd mindmap-vue3
pnpm install
pnpm dev               # http://localhost:5180

# 桌面端
cd tauri-spike
pnpm install
pnpm dev:tauri         # vite + Tauri 窗口
```

> 从 Git 仓库迁过来后 `node_modules` 失效（pnpm 硬链接指向旧路径），先 `rm -rf node_modules .pnpm-store pnpm-lock.yaml && pnpm install`。

## 质量门禁

两端分别执行（任一失败不能合并）：

```bash
pnpm verify   # parity + typecheck + lint + format:check + test
pnpm fix      # 本地一键修复：eslint --fix → prettier --write
```

- **ESLint 9** 管代码规范与红线，**Prettier 3** 管排版；`eslint-config-prettier` 作为配置数组最后一项关闭所有冲突规则，两者不会互相覆盖。
- 两端配置（`eslint.config.js` / `.prettierrc.json` / `.prettierignore` / `.editorconfig`）保持字节一致，改动必须双端同步；共享 `src/` 另有 parity 护栏。
- 源码统一 LF；生成物由 `.prettierignore` 排除，`legacy/` 为只读存档不纳入检查。
- 完整规则见 `AGENTS.md` §10。

Rust 侧：

```bash
cd tauri-spike/src-tauri
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
