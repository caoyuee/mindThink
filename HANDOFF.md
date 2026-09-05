# DesktopNaotu 现代化改造交接记录

更新时间：2026-09-05

## 1. 项目目标

原项目来自：

- https://github.com/NaoTu/DesktopNaotu

原项目技术栈老旧：Electron 11、AngularJS 1.x、kityminder-editor、Gulp 3、Browserify、Bower、TypeScript 3.x。

当前计划是把它逐步改造成：

- Vue 3 + TypeScript 5
- Vite
- markmap
- Tauri 2.x
- Windows / macOS / Linux 跨平台
- MCP 接口与内置 AI 对话功能

用户最初提出的三个方向：

1. 更新所有依赖到较新版本。
2. 用 Tauri 替代 Electron，并保持跨平台。
3. 接入 AI，提供 MCP 接口或内置 AI 对话。

## 2. 已确认的技术决策

### 前端

- 使用 Vue 3，不继续使用 AngularJS。
- 使用 TypeScript strict 模式。
- 使用 Vite，不继续使用 Gulp 3、Browserify、Bower。
- 使用 Pinia 管理状态。
- 使用 vue-router 管理页面。
- 使用 vue-i18n 管理多语言。
- 当前支持语言：zh-CN、en、zh-TW、de。

### 脑图内核

已经比较过几种方案：

- 保留 kityminder + Vue3 外壳：约 3-4 周，但受 AngularJS/SeaJS/kityminder 老架构限制。
- jsMind + Vue3：约 3-4 周，开发量较小，但 AI/Markdown 适配一般。
- markmap + Vue3：约 4-5 周，需要自行补充编辑能力，但 Markdown 与 AI 适配最好。
- maxGraph：约 6-8 周，功能过重。

最终选择：**markmap + Vue3**。

选择原因：markmap 的 Markdown 数据模型更适合后续 AI 生成、总结、改写和 MCP 操作。

### 桌面壳

- 使用 Tauri 2.x 替代 Electron。
- Rust 作为桌面后端。
- WebView 渲染层禁止 Node API。
- 文件、对话框、系统窗口、外部链接等原生能力通过 Tauri command/plugin 调用。

### AI

计划同时支持：

1. MCP Server：让 Claude Desktop、Cursor、Cline 等外部 Agent 读取和修改脑图。
2. 内置 AI 对话面板：在应用内调用 OpenAI、Claude、DeepSeek、Qwen 等模型。

AI 尚未正式开始实现。

## 3. 当前工作区结构

当前工作区：

```text
C:\Users\chenc\Desktop\codework\newNaotu
```

目录：

```text
newNaotu/
├── README.md
├── HANDOFF.md                         本交接记录
├── legacy/                            原 DesktopNaotu-master 存档
├── mindmap-vue3/                      Web 端
└── tauri-spike/                       Tauri 桌面端
```

`legacy/` 是原项目存档，仅作参考，不应继续在里面开发。

## 4. mindmap-vue3 当前状态

目录：

```text
newNaotu/mindmap-vue3/
```

这是 Web 端工程，已经从原始 spike 演化为正式工程骨架，包含：

- Vue 3
- TypeScript 5
- Vite
- Pinia
- vue-router
- vue-i18n
- markmap
- ESLint 9
- Prettier 3
- Vitest
- 4 个语言文件
- 主题持久化
- Toast
- 快捷键 composable
- 全局错误处理
- 单元测试

主要目录：

```text
src/
├── components/
│   ├── common/
│   ├── editor/
│   ├── layout/
│   └── panels/
├── composables/
├── core/
├── i18n/
├── router/
├── stores/
├── tests/
├── types/
└── views/
```

测试：

- `src/tests/tree.spec.ts`
- `src/tests/commands.spec.ts`
- 当前共 21 个测试通过。

已验证：

```text
typecheck: 0
lint: 0
format: 0
test: 21 passed
```

## 5. tauri-spike 当前状态

目录：

```text
newNaotu/tauri-spike/
```

这是 Tauri 2.x 桌面端工程，当前已经把 mindmap-vue3 的前端完整迁移进来。

### 前端主要能力

- Vue 3 + markmap 脑图编辑器
- `/editor`、`/settings`、`/about` 路由
- 4 语言 i18n
- 主题切换
- 节点增删、重命名、缩进、撤销/重做
- Tauri/Web 平台自适应文件 IO
- Toast 和全局错误处理

### Rust 后端

主要文件：

```text
src-tauri/
├── Cargo.toml
├── build.rs
├── tauri.conf.json
├── capabilities/default.json
├── icons/
└── src/
    ├── main.rs
    ├── lib.rs
    └── commands.rs
```

已实现的 Tauri command：

- `read_text_file(path)`
- `write_text_file(path, content)`
- `file_exists(path)`
- `get_user_data_dir()`
- `show_in_folder(path)`
- `open_url(url)`
- `exit_app()`
- `get_app_version()`

已配置 Tauri plugin：

- dialog
- fs
- opener
- shell

已配置系统菜单：

- Application
- File
- Edit
- View
- Help

### 当前验证结果

Tauri 前端：

```text
typecheck: 0
lint: 0
format: 0
test: 21 passed
```

Rust：

```text
cargo check: 通过
0 errors
0 warnings
```

用户已经通过其他编辑器启动 Tauri，确认：

```text
Tauri 应用可以正常运行
```

因此 Tauri 壳、Rust command、前端集成路线已经基本验证可行。

## 6. 关键修复记录

### 6.1 pnpm 移动目录导致 node_modules 失效

项目从旧路径移动到 `newNaotu` 后，pnpm 的符号链接/硬链接仍指向旧路径，导致依赖目录失效。

处理方式：删除各工程的：

- `node_modules/`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`（旧残留）

然后重新执行：

```bash
pnpm install
```

### 6.2 fromMarkdown 根节点 bug

原来的 `fromMarkdown()` 无论 Markdown 第一行是什么，都会把根节点写成 `中心主题`。

已经修复：

- 第一个 0 缩进的 `- text` 作为根节点文本。
- 没有合法根节点时才使用 `中心主题`。

两个工程都已同步修复：

- `mindmap-vue3/src/core/tree.ts`
- `tauri-spike/src/core/tree.ts`

### 6.3 icon.ico 格式错误

最初把 PNG 文件直接改名为 `.ico`，Windows Resource Compiler 报错：

```text
RC2175: resource file icon.ico is not in 3.00 format
```

已经新增：

```text
tauri-spike/scripts/gen-icons.mjs
```

使用 `png-to-ico` 生成真正的多分辨率 ICO 文件，之后 `cargo check` 已通过。

注意：当前 `icon.icns` 仍是临时 PNG 占位文件，正式发布前必须用真正的 ICNS 工具生成。

### 6.4 Rust 编译问题

已经修复：

- `tokio` 依赖缺失。
- `tauri::Manager` trait 未导入。
- `tauri::Emitter` trait 未导入。
- `show_in_folder` 错误地使用了不可用的内部 app handle。

最终 `cargo check` 通过，0 warning、0 error。

## 7. 运行命令

### Web 端

```powershell
cd C:\Users\chenc\Desktop\codework\newNaotu\mindmap-vue3
pnpm install
pnpm dev
```

默认地址：

```text
http://localhost:5180
```

### Tauri 桌面端

```powershell
cd C:\Users\chenc\Desktop\codework\newNaotu\tauri-spike
pnpm install
pnpm run dev:tauri
```

Tauri 开发命令会：

1. 启动 Vite，默认端口 `5181`。
2. 编译 Rust。
3. 打开 Tauri 窗口。
4. 加载 WebView 前端。

打包：

```powershell
cd src-tauri
cargo check
cd ..
pnpm run build:tauri
```

## 8. 当前已知问题和注意事项

### 8.1 pnpm build script 提示

pnpm 可能提示：

```text
ERR_PNPM_IGNORED_BUILDS
Ignored build scripts: esbuild, vue-demi
```

这与 pnpm 的 build script 审批机制有关。当前前端 typecheck、lint、format、test 均已运行过，Tauri 也已经通过 cargo check。

如果本地 Vite 无法启动，需要允许对应 build scripts，或使用当前机器的 pnpm 配置处理。

### 8.2 Tauri dev 的路径缓存

如果看到错误路径仍然指向旧目录：

```text
C:\Users\chenc\Desktop\codework\DesktopNaotu-master\...
```

应删除：

```text
tauri-spike/src-tauri/target/
```

然后重新运行：

```powershell
cd tauri-spike/src-tauri
cargo check
```

### 8.3 图标

`icon.ico` 已经是真正的 ICO。

`icon.icns` 目前仍是临时占位文件，正式 macOS 打包前需要生成真实 ICNS。

可用命令重新生成 Windows ICO：

```powershell
cd tauri-spike
node scripts/gen-icons.mjs
```

### 8.4 前端源码同步

目前 `mindmap-vue3` 与 `tauri-spike` 的前端代码是手工复制关系，不是 workspace 或 symlink。

修改 Web 端后，如果要同步到桌面端，需要手动复制涉及的文件。

建议下一阶段改为：

- pnpm workspace + 共享 packages，或
- 抽取 `packages/app-core` / `packages/app-ui`，或
- 让 Tauri 工程直接使用 Web 端 build 输出。

## 9. 下一步执行顺序

用户已经确认 Tauri 可以通过其他编辑器正常启动。下一步建议按以下顺序：

### 第一步：确认桌面端实际功能

在运行中的 Tauri 窗口中测试：

1. `/editor` 是否显示 markmap。
2. 示例按钮是否可以加载脑图。
3. 双击节点是否可以重命名。
4. 右键菜单是否可用。
5. 增删节点、缩进、撤销/重做是否正常。
6. 保存 Markdown 是否弹出原生保存对话框。
7. 打开 Markdown 是否弹出原生打开对话框。
8. 设置页是否能切换主题和语言。
9. File/Edit/View/Help 菜单事件是否正常。
10. 关闭窗口时是否能正常退出。

### 第二步：修复真实运行中发现的问题

重点关注：

- markmap 节点点击事件是否能正确拿到 `payload.id`。
- Tauri dialog 返回值是否兼容当前 file API。
- `capabilities/default.json` 权限是否足够但不过度开放。
- 菜单文本是否需要国际化。
- CSP 是否阻止 markmap 或 Vite HMR。
- Windows 下真实保存路径和中文路径。

### 第三步：完成正式整合

- 去掉 tauri-spike 的临时命名，改为正式 desktop 工程。
- 减少 Web 与 Tauri 前端的重复复制。
- 抽取共享 core/store/component package。
- 增加桌面端 E2E 测试。
- 生成真实 Windows/macOS/Linux 图标。
- 完成 `cargo build --release`。
- 生成 Windows MSI、macOS DMG、Linux AppImage/DEB。

### 第四步：接入 AI/MCP

建议先做 MCP，再做内置聊天：

MCP 初版工具：

- `get_current_mindmap`
- `get_node`
- `add_node`
- `update_node`
- `delete_node`
- `move_node`
- `export_markdown`
- `summarize_mindmap`

MCP 初版资源：

- `mindmap://current`
- `mindmap://node/{id}`
- `mindmap://document/{path}`

所有 AI 修改必须复用现有 store actions 和命令栈，保证可撤销。

## 10. 新工作区接手要求

新工作区启动后，首先：

1. 将工作目录设为：

```text
C:\Users\chenc\Desktop\codework\newNaotu
```

2. 阅读本文件：

```text
HANDOFF.md
```

3. 阅读两个工程规则：

```text
mindmap-vue3/AGENTS.md
tauri-spike/AGENTS.md
```

4. 优先验证当前实际运行状态，不要重复创建 spike。

5. 用户下一步最可能的请求是：

```text
修复 Tauri 实际运行中的问题，或继续完善桌面端功能。
```

## 11. 当前结论

截至本记录：

- 依赖现代化方向已确定。
- Vue3 + markmap 前端骨架已完成。
- Tauri 2.x 桌面壳已完成。
- Rust command 已通过 `cargo check`。
- 前端两个工程均已通过 typecheck/lint/format/test。
- 用户已用其他编辑器确认 Tauri 可以正常启动。
- 当前重点已经从“验证 Tauri 能不能用”转为“测试桌面端真实功能并修复运行时问题”。
- MCP/AI 尚未实现，是后续独立阶段。
