# 灵犀导图 mindThink v0.1.0 — Release Notes

> 首个公开版本 · tag 于 2026-11-13 打在 `78df6a1`（CI 构建中）
> 本文件同时用作 GitHub Release 的发布说明正文（复制粘贴即可）。
> 注：应用显示名为「灵犀导图」（en/de: mindThink）；安装包与 `productName` 仍为 `DesktopNaotu`。

## ✨ 亮点

### 本地优先的思维导图工作台

- **Markdown / KM 双格式**：打开、编辑、保存 Markdown（markmap 渲染）与 KityMinder 文件；导出 SVG / PNG / KM。
- **完整编辑能力**：节点增删改、缩进/提级、拖拽排序、备注、折叠展开、撤销/重做。
- **双击节点就地编辑**：覆盖层输入框直接贴在节点上，Enter / 失焦提交、Esc 取消；内容未改不产生撤销记录，改了可 Ctrl+Z 撤销。右键「重命名」走同一入口。
- **长文本友好**：节点文本按显示宽度截断（中文按全角计宽）加省略号，鼠标悬浮显示可换行的完整文本。
- **桌面原生体验**（Tauri 2.x）：原生菜单栏跟随界面语言实时重建（导航 / 主题 / 语言都在菜单里）、文件拖拽打开、多窗口、关闭前未保存确认。
- **文件管理**：最近打开子菜单、自动备份保留策略（默认 20 份，可配 1–100）、默认保存路径、日志落盘开关（warn/error 写入 `userData/logs/naotu.log`）。
- **单页工作台**：设置、快捷键、关于全部改为弹窗（Esc / 遮罩 / 关闭按钮），不再切换页面；`Insert` 键给选中节点添加子节点，`Ctrl/Cmd + /` 打开快捷键弹窗。
- **国际化与品牌**：简体中文 / 繁體中文 / English / Deutsch 四语言、亮暗双主题；新 mind-map 风格 SVG logo。
- **Web 端**：浏览器版与桌面端共享同一套 core/ui 代码（pnpm monorepo），体验一致。

### MCP Server（阶段一，实验性）

外部 AI Agent（Claude Desktop、Cursor、Cline 等）可以通过本机 loopback HTTP 直接操作当前导图：

- **读工具**：`query_tree` / `get_node` / `search_nodes` / `export_markdown`
- **写工具**：`apply_ops`（批量 add_child / add_sibling / update_node / delete_node）——**默认 fail-closed**，每次写入弹出批准对话框逐条列出改动；可在设置弹窗中开启自动批准。一次调用 = 一个撤销单元
- 安全设计：仅监听 `127.0.0.1` 随机端口、Bearer token 每次启动轮换、Host 校验、写入走应用命令栈（可撤销）
- 接入方法见 [`docs/mcp-clients.md`](../mcp-clients.md)，设置弹窗提供一键复制的 `claude mcp add` 命令

## 📦 下载

| 平台 | 文件 |
|---|---|
| Windows | `DesktopNaotu_0.1.0_x64-setup.exe`（NSIS）或 `.msi` |
| Linux | `.deb` / `.rpm` / `.AppImage` |
| macOS | 暂未提供（见已知限制） |

## ⚠️ 已知限制

- **Windows SmartScreen 提示**：安装包未做代码签名，首次运行点击「更多信息 → 仍要运行」即可。
- **macOS 构建**：将在后续版本通过 CI matrix 补上（`.dmg`）。
- **MCP 阶段一**：写链路仅支持单窗口；token 每次重启轮换，客户端需同步更新；`POST /mcp` 为自定义 JSON 简化实现，未实现完整 Streamable HTTP 会话管理。
- **渲染内核**：当前基于 markmap（Markdown 渲染器），缺拖拽多选 / 节点样式 / 多布局 / 小地图等编辑器级能力。**下一个里程碑 M1 将换用 simple-mind-map**。
- 快捷键部分条目为「规划中」（见应用内快捷键弹窗）。

## 🙏 致谢

[markmap](https://github.com/markmap/markmap) · [Tauri](https://tauri.app) · [Vue](https://vuejs.org)
