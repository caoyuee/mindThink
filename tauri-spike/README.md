# DesktopNaotu · Tauri Desktop

> 桌面版脑图 · Tauri 2.x 桌面壳 + Vue 3 + markmap
>
> 可打包为 Windows / macOS / Linux 原生应用
>
> 状态: **0.1.0 alpha**（前端 + Tauri 集成完成，待本地 cargo 构建验证）

---

## 1. 项目简介

**DesktopNaotu** 是 [NaoTu/DesktopNaotu](https://github.com/NaoTu/DesktopNaotu) 的现代化重构版本。本目录是**桌面端**实现：

- 桌面壳: Tauri 2.x（替代 Electron）
- 前端: Vue 3 + markmap（复用 spike/mindmap-vue3）
- 后端: Rust 命令（位于 `src-tauri/`）
- 跨平台: Win10+ / macOS 10.15+ / Linux x86_64+arm64

## 2. 集成模式

```
spike/
├── mindmap-vue3/   ← 完整 Web 端（开发迭代主要在这里）
└── tauri-spike/    ← 本目录（Tauri 桌面壳，发布目标）
    ├── src-tauri/  Rust 后端
    ├── src/        前端（已包含 mindmap 编辑器）
    └── docs/       跨平台构建文档
```

- 前端源代码**已完整迁移**自 `mindmap-vue3`
- `core/file.ts` 已改造为 Tauri/Web 平台自适应
- 修改 mindmap-vue3 后需要**手动同步**到本目录

## 3. 快速开始

### 前置依赖

- **Node.js** ≥ 22
- **pnpm** ≥ 9
- **Rust** ≥ 1.77（`rustup`）
- **Tauri CLI** ≥ 2.x：`cargo install tauri-cli --version "^2"`
- 平台特定依赖见 `docs/BUILD.md`

### 命令

```bash
# 1. 安装前端依赖
pnpm install

# 2. 类型检查
pnpm typecheck

# 3. 仅前端开发（http://localhost:5181）
pnpm dev

# 4. 完整桌面开发（vite + Tauri 窗口）
pnpm dev:tauri

# 5. 类型/Lint/Format 验证
pnpm verify          # 前端
cargo check          # Rust（必须在 src-tauri/ 下）

# 6. 打包（产物在 src-tauri/target/release/bundle/）
pnpm build:tauri     # 自动跑 pnpm build + tauri build
```

## 4. 工程结构

```
tauri-spike/
├── src/                            前端（已迁移 mindmap 编辑器）
│   ├── App.vue                     根布局 + spike 平台提示
│   ├── main.ts                     入口（pinia + i18n + router + error）
│   ├── platform.ts                 平台检测 (Tauri/Web)
│   ├── env.d.ts
│   ├── core/
│   │   ├── tree.ts                 树结构与搜索
│   │   ├── km.ts                   .km 导入转换
│   │   ├── mcp.ts                  MCP/AI 上下文模型
│   │   ├── commands.ts             命令栈
│   │   ├── logger.ts
│   │   ├── file.ts                 ⭐ 统一文件 IO（自动路由）
│   │   ├── tauri-file.ts           invoke 实现
│   │   └── web-file.ts             浏览器 fallback
│   ├── stores/                     Pinia (mindmap, ui, config)
│   ├── composables/                (useShortcuts, useToast, useErrorHandler)
│   ├── i18n/                       4 语言 (zh-CN/en/zh-TW/de)
│   ├── router/                     vue-router
│   ├── components/
│   │   ├── layout/                 AppHeader, AppStatusBar
│   │   ├── editor/                 MindEditor, NodeContextMenu
│   │   ├── panels/                 Toolbar, Properties, OutlineTree
│   │   └── common/                 Toast
│   ├── views/                      EditorView, SettingsView, AboutView, NotFoundView
│   ├── types/                      markmap.d.ts
│   ├── tests/                      Vitest 单元测试
│   └── styles/global.css
├── src-tauri/                      Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json             窗口、安全、bundle
│   ├── build.rs
│   ├── capabilities/default.json  权限白名单
│   ├── icons/                      跨平台图标
│   └── src/
│       ├── main.rs                 桌面入口
│       ├── lib.rs                  Builder + 菜单 + 命令注册
│       └── commands.rs             8 个 invoke 命令
├── docs/
│   └── BUILD.md                    跨平台构建指南
├── eslint.config.js / prettier / vitest
└── package.json / tsconfig.json / vite.config.ts
```

## 5. 关键技术决策

### 5.1 文件 IO 抽象

`src/core/file.ts` 提供**统一接口**，自动路由：

```typescript
import { saveFile, openFile } from '@/core/file';

await saveFile(content, suggestedName);  // → tauri 或 web
await openFile();                          // → tauri 或 web
```

调用方（stores/components）**完全不需要**关心运行平台。

### 5.2 系统菜单

Rust 端通过 `app.emit("menu_event", id)` 发送菜单点击事件，前端监听：

```typescript
import { listen } from '@tauri-apps/api/event';
await listen<string>('menu_event', (e) => { /* 处理 e.payload */ });
```

业务逻辑保持在 Vue 层。

### 5.3 安全模型

| 维度 | 设置 |
|---|---|
| `nodeIntegration` | **关闭** |
| `contextIsolation` | **开启** |
| CSP | `default-src 'self'; connect-src 'self' ipc: http://ipc.localhost` |
| 权限 | `capabilities/default.json` 白名单 |
| 路径校验 | Rust `validate_path()` 拒绝相对路径 |

## 6. 质量门禁

```bash
pnpm typecheck       # 必过
pnpm lint            # 必过
pnpm format:check    # 必过
pnpm test            # 必过（vitest）
pnpm verify          # 上述合并
```

加上 Rust 端：

```bash
cd src-tauri
cargo check
cargo clippy         # 推荐
```

## 7. MCP stdio Server

独立 MCP stdio binary 与桌面应用复用同一套 Rust JSON-RPC 分派：

```bash
cd src-tauri
cargo run --bin desktop-naotu-mcp
```

Server 从 stdin 按行读取 JSON-RPC，并将响应逐行写到 stdout。可通过
`DESKTOP_NAOTU_MCP_CONTEXT` 注入启动时的脑图上下文快照；未设置时使用一个空白脑图：

```json
{
  "tools": [],
  "resources": [{ "uri": "mindmap://current" }],
  "current": { "title": "Demo", "markdown": "- Demo\n", "nodeCount": 1 },
  "nodes": {}
}
```

当前 stdio Server 支持 `initialize`、`tools/list`、`resources/list`、
`resources/read` 和 `tools/call` 请求封装。写操作 payload 仍需由桌面前端通过 Pinia
store actions 执行，防止绕过撤销/重做模型。环境变量提供的是启动时快照，不会自动跟随
已运行窗口中的文档变化。

独立 HTTP Server 复用相同协议分派，且只绑定 loopback：

```bash
cd src-tauri
cargo run --bin desktop-naotu-mcp-http
curl -X POST http://127.0.0.1:8765/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
```

可通过 `DESKTOP_NAOTU_MCP_PORT` 修改端口。Server 仅接受 `POST /mcp`，请求体上限为
1 MiB；它不监听外部网络接口，也不会自动执行写工具。

## 8. 文档索引

- [AGENTS.md](AGENTS.md) — AI Agent 规则（Tauri 特定红线）
- [CONVENTIONS.md](CONVENTIONS.md) — 代码风格
- [ARCHITECTURE.md](ARCHITECTURE.md) — 架构总览
- [docs/BUILD.md](docs/BUILD.md) — 跨平台构建指南

## 9. 路线图

- [x] Tauri 2.x 工程脚手架
- [x] Rust 自定义命令（read/write/dialog/exit）
- [x] 前端 invoke() 桥接
- [x] Web/Tauri 平台自适应文件 IO
- [x] 系统菜单（File/Edit/View/Help）
- [x] 脑图编辑器集成
- [x] 文件路径、dirty 状态、正常保存/另存为与退出确认
- [x] 最近文件、自动保存、时间戳备份与拖拽打开
- [x] SVG/PNG 导出、搜索、大纲、折叠/展开与节点备注
- [x] `.km` 导入转换
- [x] 多窗口基础能力（新窗口加载独立 SPA 状态）
- [x] MCP/AI 上下文模型（`core/mcp.ts`）
- [x] 内置 AI 对话面板（OpenAI-compatible endpoint，只读建议）
- [x] MCP Tauri 事件桥接（`mcp_request` / `mcp_response`，写操作复用命令栈）
- [x] MCP JSON-RPC 事件桥接（`mcp_rpc_request` / `mcp_rpc_response`）
- [ ] MCP Server stdio/HTTP transport 与外部 Agent 工具执行
- [ ] **本地 cargo 构建验证**（当前已通过 `cargo check`）
- [ ] 自动更新（tauri-plugin-updater）
- [ ] 代码签名（Win/macOS）

## 9. MCP / AI 接入

当前桌面端提供两层 MCP 接口：

1. 标准 JSON-RPC 方法适配器（`src/core/mcp.ts`）
2. Tauri 事件桥接（`mcp_rpc_request` / `mcp_rpc_response`）

请求示例：

```json
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
```

调用工具示例：

```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"update_node","arguments":{"id":"n_x","text":"新标题"}}}
```

外部 bridge 应监听 `mcp_rpc_response`，并将收到的每一条 JSON-RPC 请求通过 Tauri 事件发送到 `mcp_rpc_request`。`tools/call` 的写操作由前端 store action 执行，因此继续进入撤销/重做栈。独立 stdio/HTTP transport 尚未内置，待后续以 Rust sidecar 或本地受控 HTTP 服务实现。

内置 AI 面板使用 OpenAI-compatible `chat/completions` 接口。AI 返回默认只显示建议；用户点击“应用建议”后，才会通过 `updateNote()` 写入当前节点备注。

## 10. 许可

[GPL-2.0](../../LICENSE)