# mindThink · Tauri 桌面端

> 本项目已更名为 **mindThink**（原 DesktopNaotu）。
> 本目录 `tauri-spike/` 是 **桌面端**（Tauri 2.x 发布目标）。

## 定位

- Tauri 2.x 桌面壳：前端复用 `../mindmap-vue3/`，后端为 Rust（`src-tauri/`）。
- 发布目标：Windows / macOS / Linux，安装包 <25MB。
- 产品定位与技术栈见 [`../README.md`](../README.md)。

## 必读文档（开发前）

| 文档 | 何时读 |
|---|---|
| [`../README.md`](../README.md) | 第一次接触项目 |
| [`../AGENTS.md`](../AGENTS.md) | 修改任何代码前（**统一规则基线**） |
| [`../docs/decisions.md`](../docs/decisions.md) | 了解架构决策 D1-D6 |
| [`../docs/architecture.md`](../docs/architecture.md) | 修改跨模块代码前 |
| [`../docs/roadmap.md`](../docs/roadmap.md) | 领取开发任务前 |

> 本目录内 `AGENTS.md` 为 Tauri 平台补充规则（Rust 三件套、isTauri 检测等），与根 `AGENTS.md` 冲突时以根为准。`ARCHITECTURE.md`/`CONVENTIONS.md` 为现状约定。

## 快速开始

```bash
pnpm install
pnpm dev:tauri   # vite + Tauri 窗口

# 验证
pnpm verify                          # 前端：parity + typecheck + lint + format + test
cd src-tauri && cargo fmt -- --check && cargo check && cargo test && cargo clippy --all-targets -- -D warnings
```

## 目录要点

- `src-tauri/src/commands.rs` — Tauri command 定义（async + `AppResult<T>`）
- `src-tauri/src/lib.rs` — command 注册（`generate_handler![]`）
- `src-tauri/capabilities/default.json` — 权限声明
- `src-tauri/src/mcp.rs` / `mcp_http.rs` — MCP 协议层（stdio / HTTP server）
- `src/core/tauri-file.ts` — Tauri 文件 IO 实现（`core/file.ts` 的 invoke 分支）

## 跨平台构建

见 `docs/BUILD.md`；问题排查见 `docs/TROUBLESHOOTING.md`。

## 许可

[GPL-2.0](../LICENSE)
