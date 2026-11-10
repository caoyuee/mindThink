# DesktopNaotu v0.1.0 — Release Notes

> 首个公开版本 · 2026-11-10
> 本文件同时用作 GitHub Release 的发布说明正文（复制粘贴即可）。

## ✨ 亮点

### 本地优先的思维导图工作台

- **Markdown / KM 双格式**：打开、编辑、保存 Markdown（markmap 渲染）与 KityMinder 文件；导出 SVG / PNG / KM。
- **完整编辑能力**：节点增删改、缩进/提级、拖拽排序、备注、折叠展开、撤销/重做（一次 MCP 批量写入 = 一个撤销单元）。
- **桌面原生体验**（Tauri 2.x）：原生菜单栏跟随界面语言实时重建、文件拖拽打开、多窗口、关闭前未保存确认。
- **文件管理**：最近打开子菜单（原生菜单内联）、自动备份保留策略（默认 20 份，可配 1–100）、默认保存路径、日志落盘开关（warn/error 写入 `userData/logs/naotu.log`）。
- **国际化**：简体中文 / 繁體中文 / English / Deutsch 四语言；亮暗双主题。
- **Web 端**：浏览器版与桌面端共享同一套 core/ui 代码（pnpm monorepo），体验一致。

### MCP Server（阶段一，实验性）

外部 AI Agent（Claude Desktop、Cursor、Cline 等）可以通过本机 loopback HTTP 直接操作当前导图：

- **读工具**：`query_tree` / `get_node` / `search_nodes` / `export_markdown`
- **写工具**：`apply_ops`（批量 add_child / add_sibling / update_node / delete_node）——**默认 fail-closed**，每次写入弹出批准对话框逐条列出改动；可在设置中开启自动批准
- 安全设计：仅监听 `127.0.0.1` 随机端口、Bearer token 每次启动轮换、Host 校验、写入走应用命令栈（可撤销）
- 接入方法见 [`docs/mcp-clients.md`](../mcp-clients.md)，设置页提供一键复制的 `claude mcp add` 命令

## 📦 下载

| 平台 | 文件 |
|---|---|
| Windows | `DesktopNaotu_0.1.0_x64-setup.exe`（NSIS）或 `.msi` |
| Linux | `.deb` / `.rpm` / `.AppImage` |
| macOS | 暂未提供（见已知限制） |

## ⚠️ 已知限制

- **Windows SmartScreen 提示**：安装包未做代码签名，首次运行点击「更多信息 → 仍要运行」即可。
- **macOS 构建**：将在后续版本通过 CI matrix 补上（`.dmg`）。
- **MCP 阶段一**：写链路仅支持单窗口；token 每次重启轮换，客户端需同步更新。
- 快捷键部分条目为「规划中」（见应用内快捷键页）。

## 🙏 致谢

[markmap](https://github.com/markmap/markmap) · [Tauri](https://tauri.app) · [Vue](https://vuejs.org)
