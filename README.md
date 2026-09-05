# DesktopNaotu · 工程总览

> 桌面版脑图 · 现代化重构
>
> - Web 端：Vue 3 + markmap + 4 语言 i18n
> - 桌面端：Tauri 2.x 桌面壳 + Rust 后端
> - 原项目存档：保留为 `legacy/`，方便对照与回退

## 目录结构

```
newNaotu/                          ← 你在这里
├── README.md                       本文件
├── mindmap-vue3/                   Web 端（Vue 3 + markmap）
├── tauri-spike/                    桌面端（Tauri 2.x + Rust）
└── legacy/                         原 DesktopNaotu-master 存档（仅供参考）
```

| 路径 | 用途 | 状态 |
|---|---|---|
| [`mindmap-vue3/`](mindmap-vue3/) | Web 端 | ✅ 0.1.0 alpha |
| [`tauri-spike/`](tauri-spike/) | 桌面端 | ✅ 0.1.0 alpha（前端） / ⏳ 待 cargo 验证 |
| [`legacy/`](legacy/) | 原 Electron + kityminder 项目存档 | 📦 仅参考，不再维护 |

## 两个工程的关系

```
   ┌─────────────────────┐
   │     mindmap-vue3     │   ← 迭代开发主战场
   │     (Web 端)         │
   └──────────┬──────────┘
              │ 源码复制（手工同步）
              ▼
   ┌─────────────────────┐
   │     tauri-spike      │   ← 发布目标
   │     (桌面端)         │
   │     ├─ Rust 后端     │
   │     └─ 前端 + 适配   │
   └─────────────────────┘
```

未来可改为 pnpm workspace 或 git submodule 自动同步。

## 快速开始

按需选择：

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

如果从 Git 仓库迁过来后 `node_modules` 失效（pnpm 硬链接指向旧路径），先删除再重装：

```bash
rm -rf node_modules .pnpm-store pnpm-lock.yaml
pnpm install
```

## 共用规则

| 文档 | 何时读 |
|---|---|
| [mindmap-vue3/AGENTS.md](mindmap-vue3/AGENTS.md) | Web 端规则（基线） |
| [tauri-spike/AGENTS.md](tauri-spike/AGENTS.md) | Tauri 端补充规则 |
| [tauri-spike/docs/BUILD.md](tauri-spike/docs/BUILD.md) | 跨平台构建指南 |
| [tauri-spike/docs/TROUBLESHOOTING.md](tauri-spike/docs/TROUBLESHOOTING.md) | 问题排查 |

## 路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| 1. Spike 验证 | Vue3 + markmap 可行性 | ✅ |
| 2. 正式工程骨架 | 路由、store、i18n、测试、CI | ✅ |
| 3. Tauri 桌面壳 | 桌面集成、跨平台打包 | ✅（前端）/ ⏳（cargo 验证） |
| 4. MCP/AI 集成 | 暴露脑图为 MCP Resources | ⏳ |
| 5. v0.2.0 | 拖拽节点、PNG导出、更多功能 | ⏳ |
| 6. v1.0.0 | 自动更新、签名、稳定版发布 | ⏳ |

## 改造前 vs 改造后

| 维度 | 改造前（`legacy/`） | 改造后（`mindmap-vue3/` + `tauri-spike/`） |
|---|---|---|
| 桌面壳 | Electron 11 | Tauri 2.x |
| 前端框架 | AngularJS 1.4 + jQuery | Vue 3 + `<script setup>` |
| 脑图内核 | kityminder-editor | markmap |
| 构建工具 | gulp 3 + browserify | Vite 6 |
| 包管理 | npm + bower | pnpm |
| 测试 | 无 | Vitest + 14 个测试 |
| 类型检查 | target ES3 | TypeScript strict |
| Lint/Format | 无 | ESLint 9 + Prettier 3 |
| CI | 无 | GitHub Actions |
| 国际化 | 4 语言硬编码 | vue-i18n + 4 语言 |
| 撤销/重做 | 自行实现 | 快照命令栈 |
| 脑图格式 | km (XML) | Markdown (.md) |
| 安装包体积 | ~50MB | ~10-20MB |
| 启动内存 | ~150MB+ | ~40-60MB |

## 已知限制

- markmap 不支持节点图片（kityminder 支持）。spike 阶段先不做
- Tauri 应用体积约 10-20MB（仍小于 Electron 的 50MB+）
- DSH 沙箱无法跑 `pnpm dev:tauri` / `cargo build`，需本地验证

## 许可

[GPL-2.0](../LICENSE)