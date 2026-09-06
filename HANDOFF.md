# DesktopNaotu 当前进度与交接

更新时间：2026-09-06

> 📌 下一批功能实施计划见 `NEXT-PLAN.md`（规划产物：A 工程收口 / B 桌面原生打磨 /
> C 能力增强三批任务的规格、执行顺序与验证要求）。本文件记录已完成与下一步必须做。

## 1. 接手入口

工作区：

```text
C:\Users\chenc\Desktop\codework\newNaotu
```

主要工程：

- `mindmap-vue3/`：Web 版本，也是前端能力基线。
- `tauri-spike/`：Tauri 2.x 桌面发布目标。
- `legacy/`：旧 Electron/AngularJS/kityminder 项目，只作逻辑参考，不继续开发。
- `mindThink.svg`：正式应用图标源文件。

接手后先阅读：

- `mindmap-vue3/AGENTS.md`
- `tauri-spike/AGENTS.md`
- `tauri-spike/CONVENTIONS.md`
- `tauri-spike/ARCHITECTURE.md`

两个目录都不是独立 Git 仓库；不要假定可使用 git 回滚。不要覆盖用户已有改动。

## 2. 架构红线

- Vue 组件 -> Pinia store -> `core/` -> types。
- 文档修改只能经过 `stores/mindmap.ts` actions 和 `applyEdit()`，保证撤销/重做。
- `doc.value` 只能由 store 内 `_replaceDoc()` 直接替换。
- markmap 集成只允许在 `components/editor/MindEditor.vue`。
- markmap 类型只在 `src/types/markmap.d.ts` 收口。
- 文件 IO 只通过 `src/core/file.ts`；Tauri 实现再路由到 `tauri-file.ts`。
- WebView 禁止 Node API。
- Tauri Rust command 原则上必须 async 并返回 `AppResult<T>`。
- 四语言同步：`zh-CN`、`en`、`zh-TW`、`de`。
- 用户可见错误用 Toast；不得静默 catch。
- AI/MCP 写操作必须调用 store actions，不得绕过命令栈。

## 3. 已完成功能

### 文档与文件工作流

Tauri 桌面端已经实现：

- 当前文件路径 `documentPath`
- dirty 状态 `isDirty`
- 正常保存、另存为
- 新建/打开/退出前未保存确认
- 最近打开文件与清理
- 每 30 秒自动保存与时间戳备份
- Markdown 拖拽打开
- `.md` / `.markdown` / `.km` 打开
- `.km` 导入后清空源路径并标记 dirty，防止覆盖源 `.km`
- SVG/PNG 导出
- 中文路径和路径安全校验基础支持

关键文件：

- `tauri-spike/src/stores/mindmap.ts`
- `tauri-spike/src/core/file.ts`
- `tauri-spike/src/core/tauri-file.ts`
- `tauri-spike/src/core/web-file.ts`
- `tauri-spike/src/App.vue`
- `tauri-spike/src-tauri/src/commands.rs`

### 脑图编辑

已经实现：

- 节点增删、重命名
- 子节点/兄弟节点
- 缩进/反缩进
- 快照式撤销/重做
- 搜索与根到匹配节点路径
- 递归大纲和选中同步
- 节点备注
- markmap 原生折叠/展开
- `.km` 递归导入，保留文本、备注和 metadata

### 多窗口与权限

- 原生 `new-window` 菜单和动态 `editor-*` WebviewWindow。
- `capabilities/default.json` 已加入 `core:window:allow-destroy`。
- capability 覆盖 `main` 和 `editor-*`，修复关闭时报错：

```text
window.destroy not allowed
```

关闭权限修复已通过 Tauri debug build，但运行中的旧程序必须重启才能加载新 capability。

### AI

Web/Tauri 均有 OpenAI-compatible AI 助手：

- endpoint 只允许 `http:` / `https:`
- model、API key 配置
- 当前脑图 Markdown 上下文
- AI 建议展示
- 用户确认后写入当前节点备注
- 写入使用 `updateNote()`，进入撤销栈

关键文件：

- `*/src/core/ai.ts`
- `*/src/components/panels/AiAssistant.vue`
- `*/src/views/SettingsView.vue`
- `*/src/stores/config.ts`

API key 当前存于 localStorage/配置对象，尚未接 OS 凭据管理器。

### MCP

TypeScript 协议层支持：

- `initialize`
- `tools/list`
- `resources/list`
- `resources/read`
- `tools/call`
- `mindmap://current`
- `mindmap://node/{id}`
- JSON-RPC 错误 `-32600/-32601/-32602/-32700`
- 单行 JSON 编解码，允许一个行尾换行并拒绝中间换行

Rust 已实现：

- Tauri IPC command `mcp_rpc_request`
- 独立 stdio Server：`desktop-naotu-mcp`
- 独立 loopback HTTP Server：`desktop-naotu-mcp-http`
- HTTP 默认 `127.0.0.1:8765/mcp`
- HTTP 仅允许 `POST /mcp`，body 上限 1 MiB
- stdio/HTTP 使用 `DESKTOP_NAOTU_MCP_CONTEXT` 启动时上下文快照

关键文件：

- `tauri-spike/src/core/mcp.ts`
- `tauri-spike/src-tauri/src/mcp.rs`
- `tauri-spike/src-tauri/src/mcp_http.rs`
- `tauri-spike/src-tauri/src/bin/desktop-naotu-mcp.rs`
- `tauri-spike/src-tauri/src/bin/desktop-naotu-mcp-http.rs`

stdio 与 HTTP 均做过真实端到端请求验证。尚未与运行中的桌面文档实时同步。

### 应用图标

`mindThink.svg` 已通过官方命令生成并替换 `tauri-spike/src-tauri/icons/` 全套资源：

```powershell
pnpm exec tauri icon ..\mindThink.svg --output src-tauri\icons
```

已生成真实 ICO、ICNS、PNG、Windows Store、iOS 和 Android 图标。PNG 尺寸、ICO/ICNS 文件头和桌面构建均已验证。

## 近期归档快照（2026-09-06）

> 本条是"读完可直接接手"的最小快照。下面的 4/5/6/7… 等章节仍保留历史细节，
> 但只有本条随时保持与最新代码一致。

### 当前能力（除历史已列功能外，最近一轮新增）

- **S1-S5 完整可用**（详见第 10 节历史）：
  - 最近文件数量设置（1-20，降上限自动裁剪）
  - 状态栏显示当前文件名 / 未命名文档
  - 窗口标题同步文档名 + dirty（`* 文件 · App`）
  - AI 请求 30s 超时、取消按钮、卸载中止
  - 用户可见字符串清理（新节点/对话框/启动错误/placeholder 全部 i18n）
- **AI 助手 = 全局浮动按钮 + 右侧抽屉**：右下角可拖动 FAB（Pointer Events，4px 拖动阈值），点击弹出 380px 抽屉；不再占侧栏空间（侧栏让给节点属性）。
- **markmap 交互**：选中高亮（覆盖 markmap 默认几乎透明的 #ff02 → 亮/暗主题淡蓝底、无边框）；手型光标；单击选中。
- **右键菜单**：根节点仅"添加子节点"，无孤立分隔线；"当前节点"面板按钮 flex 并排布局。
- **快捷键体系（页面 + 真正可用）**：
  - `/shortcuts` 路由页面由 `core/shortcuts.ts::SHORTCUT_REGISTRY` 数据驱动，todo 项灰显"待实现"。
  - 全局 Mod+/ 跳转快捷键页；顶栏导航入口。
  - `useShortcuts.bindById` 从 registry 统一绑定；键归一化支持 ↑/↓/←/→ 与 Space。
  - **可用项**：撤销/重做、Tab 缩进、Delete 删除、Alt+↑↓ 同级移动、Enter 加兄弟、F2 加父、Space 折叠、方向键导航、Mod+C/X/V 节点剪贴板、Mod+F 聚焦搜索、Mod+Enter 居中。
  - **todo（需富文本/多选/布局算法）**：Mod+A 全选、Mod+B/I 加粗斜体、Shift+Enter 换行、Mod+0 布局、双击空白。
- **.km 原生导出**：`toKmJson()` round-trip 编码器（保留 meta 扩展字段、叶子省略 children）+ 导出按钮 + Tauri 保存对话框 / Web 下载；新增 round-trip 测试。
- **测试基建**：两端接入 `@vue/test-utils` + vitest vue plugin（`vitest.config.ts` 用 `vue() as never` 兼容 vite 5/6 差异）。

### 当前验证数字（最近 verify 全绿）

```text
Tauri 前端 Vitest: 55 passed（8 个测试文件）
Web Vitest:        45 passed（8 个测试文件）
```

两端 `pnpm verify`（typecheck + lint + format:check + test）通过；
Rust `cargo test` 5 passed、clippy -D warnings 通过（历史验证）。

### 本会话提交历史（自快捷键说明页起）

| commit | 内容 |
|---|---|
| `c46a6ef` | feat: 新增快捷键说明页与全局 Mod+/ 快捷键 |
| `d48ceb0` | docs: 在 HANDOFF.md 记录快捷键说明页进度 |
| `f01a801` | 修复部分样式错位，新增快捷键页面（含 registry、@vue/test-utils、reorderNode） |
| `6882656` | docs: 记录快捷键 registry 统一与组件测试收尾 |
| `2a84383` | feat: 支持导出 KityMinder .km 原生格式 |
| `e020a75` | feat: 补齐真正可用的快捷键（F2/Enter/方向键/剪贴板/Space） |

未提交变更：无（工作树 clean）。

## 4. 最近一次关键修复：节点选择与撤销按钮

用户报告：

1. 无法选中节点并在选中节点后添加子节点。
2. 添加子节点后撤销/重做按钮仍禁用。

根因：

- markmap 0.18 的 runtime node 直接位于 `g.markmap-node.__data__`；旧代码错误读取 `__data__.data.payload`，导致拿不到 id。
- `CommandStack` 是普通 class，`computed(() => stack.canUndo())` 没有响应式依赖，第一次计算为 false 后一直缓存。
- Toolbar 的子节点按钮写死使用根节点 id，没有使用 `selectedId`。

已经在 Web/Tauri 两端同步修复：

- 从 `__data__.payload.id` 读取节点 id。
- 点击节点后 `store.select(id)` 并调用 `mm.setHighlight()`。
- 每次重渲染后按 `selectedId` 重新定位 runtime node 并恢复高亮。
- Toolbar 使用 `selectedId ?? root.id` 作为父节点。
- `addChild()` 返回新节点 id，并自动选中新节点。
- store 新增响应式 `historyRevision`；execute/undo/redo/clear 后递增，使 `canUndo/canRedo` 重新计算。
- 缺失父节点时不创建命令历史。

修改文件：

- `tauri-spike/src/components/editor/MindEditor.vue`
- `tauri-spike/src/components/panels/Toolbar.vue`
- `tauri-spike/src/stores/mindmap.ts`
- `tauri-spike/src/types/markmap.d.ts`
- `mindmap-vue3/src/components/editor/MindEditor.vue`
- `mindmap-vue3/src/components/panels/Toolbar.vue`
- `mindmap-vue3/src/stores/mindmap.ts`
- `mindmap-vue3/src/types/markmap.d.ts`

新增测试：

- `tauri-spike/src/tests/mindmap-store.spec.ts`
- `mindmap-vue3/src/tests/mindmap-store.spec.ts`

测试覆盖“选择父节点 -> 添加子节点 -> 自动选中新节点 -> undo -> redo”和无效父节点不入栈。

重要：代码与自动测试已通过，但仍需要用户在新构建 GUI 中手工确认点击高亮、添加位置和按钮即时状态。

## 5. 当前验证证据

最近完整前端测试：

```text
Tauri Vitest: 4 files, 35 tests passed
Web Vitest:   6 files, 31 tests passed
```

最近静态/构建验证：

- 两端 `pnpm typecheck` 通过。
- 两端 `pnpm lint` 通过。
- 两端 `pnpm format:check` 通过。
- 两端 `pnpm build` 通过。
- Rust `cargo check` 通过。
- Rust `cargo test`：5 passed。
- `cargo clippy --all-targets -- -D warnings` 通过。
- Windows MSI/NSIS 曾成功生成。
- Tauri 多 binary 曾导致 installer 错选 MCP HTTP binary；已在 `Cargo.toml` 加：

```toml
default-run = "desktop-naotu"
```

重打包日志已确认主程序为 `desktop-naotu.exe`。

产物：

```text
tauri-spike/src-tauri/target/release/desktop-naotu.exe
tauri-spike/src-tauri/target/release/bundle/msi/DesktopNaotu_0.1.0_x64_en-US.msi
tauri-spike/src-tauri/target/release/bundle/nsis/DesktopNaotu_0.1.0_x64-setup.exe
```

注意：上述 release installer 在最新“节点选择/撤销”和“关闭权限/新图标”修复前后可能存在时间差。正式交付前必须重新执行 `pnpm build:tauri`。

## 6. 当前运行状态

最后一次检查时有两个旧应用实例：

```text
PID 9192  target/release/desktop-naotu.exe
PID 22076 target/debug/desktop-naotu.exe
```

不要假定 PID 仍有效，先用 `Get-Process` 检查。它们是旧构建，不能验证最新修复。

默认 `target/debug/desktop-naotu.exe` 因运行中实例占用而无法覆盖，所以最新节点修复使用独立 target 构建验证：

```text
tauri-spike/src-tauri/target-verify/debug/desktop-naotu.exe
```

`target-verify` 最后一次 `cargo build --bin desktop-naotu` 成功。用户应关闭旧实例后运行该 executable 做 GUI 验收。

## 7. 下一步必须做

按优先级：

### P0：GUI 实机回归

运行最新构建，逐项检查：

1. 点击任意 markmap 节点是否有明确高亮。
2. 点击工具栏“子节点”是否添加到当前选中节点。
3. 新节点是否自动成为选中节点。
4. 添加后 Undo 是否立即启用。
5. Undo 后 Redo 是否立即启用。
6. 右键菜单的新增、重命名、删除、缩进是否作用于正确节点。
7. 从大纲选择节点后 markmap 是否同步高亮。
8. 关闭主窗口和 `editor-*` 子窗口是否不再报 destroy 权限错误。

如果第 1 项仍失败，优先在实际 WebView DevTools 检查 `g.markmap-node.__data__`，不要再猜层级。markmap 0.18 类型表明它应是 runtime `INode`，payload 应在 `__data__.payload`。

### P0：重新生成正式安装包

关闭占用 `target/debug` / `target/release` 的旧实例后：

```powershell
cd C:\Users\chenc\Desktop\codework\newNaotu\tauri-spike
pnpm build:tauri
```

确认日志必须是：

```text
Built application at: ...\target\release\desktop-naotu.exe
```

然后安装新 NSIS/MSI，验证新图标、关闭权限和节点交互。

### P1：完整桌面验收

- 新建、打开、保存、另存为、退出确认。
- 中文/长路径、只读文件、源文件被删除。
- 最近文件失效路径。
- 自动保存、备份生成与恢复。
- Markdown/KM 拖放。
- `.km` 导入后只能另存 Markdown，不能覆盖源文件。
- SVG/PNG 导出内容和尺寸。
- 多窗口隔离、关闭和退出行为。
- AI endpoint/CSP、错误、超时和取消。

### P1：MCP 与桌面实时同步

当前 MCP Server 只读取启动时 context 快照。需要设计安全的桌面实时桥接：

- Server 获取当前窗口文档 context。
- 外部 `tools/call` 写操作转发至对应窗口。
- 所有写操作必须经过 store actions/命令栈。
- HTTP 增加随机会话 token 或其它鉴权。
- 明确多窗口时连接哪个文档。
- 增加 Claude Desktop/Cursor/Cline 配置示例。

### P1：发布工程

尚未做：

- Windows Authenticode 签名。
- macOS Developer ID、hardened runtime、notarization。
- Linux/macOS 实机打包和安装验证。
- `tauri-plugin-updater`、更新签名公钥、manifest、失败回滚。
- GitHub Actions 三平台 CI 和 artifact 发布。

### P2：工程质量

- Web/Tauri 前端目前手工同步，应抽取共享 package 或改为单一前端源。
- 主 bundle 约 800 KiB，有 Vite chunk >500 KiB 警告；需要代码分割。
- 自动备份尚未做保留策略和旧文件清理。
- 原生 Rust 菜单仍是英文硬编码，需要本地化。
- API key 应改用系统凭据管理器，不应长期明文存储。
- 替换 `window.confirm/prompt` 为项目 dialogs 组件。

### Vite 文件监视 EBUSY 修复（2026-09-05）

用户报告在运行 `pnpm dev:tauri` 时 Vite 抛出：

```text
Emitted 'error' event on FSWatcher instance
errno: -4082, syscall: 'watch', code: 'EBUSY'
path: src-tauri/target/debug/deps/desktop_naotu.exe
```

根因：Vite dev server 默认会监视 `node_modules/` 和项目根，chokidar 会顺藤摸瓜发现 `src-tauri/target/debug/deps/*.exe`，这些 Tauri 编译产物在 Windows 下被锁。`*.rs` 文件被监视也不必要。

修复：`tauri-spike/vite.config.ts` 新增 `server.watch.ignored`：

```typescript
ignored: [
  '**/src-tauri/target/**',
  '**/*.rs',
  '**/.git/**',
],
```

验证：`pnpm typecheck`、`pnpm build` 通过。

仍需在 GUI 中执行 `pnpm dev:tauri` 启动开发模式，确认 dev server 不再抛 EBUSY。

### 节点手型光标（2026-09-05）

用户报告：选中/悬停节点时，鼠标光标没有变成手型，无法直观看出节点可点击。

修复：在两端 `components/editor/MindEditor.vue` 的 scoped 样式中添加 `:deep()` 选择器，把 markmap 动态生成的节点组的 cursor 设为 pointer：

```css
.canvas > svg :deep(g.markmap-node) {
  cursor: pointer;
}
.canvas > svg :deep(g.markmap-node circle),
.canvas > svg :deep(g.markmap-node rect) {
  cursor: pointer;
}
```

说明：

- 使用 `:deep()` 是因为 markmap 渲染的 `<g class="markmap-node">` 节点在运行时创建，不带 Vue 的 scoped 属性。
- 同时作用于 `g.markmap-node` 本身和其中的 `circle`/`rect`，确保鼠标悬停在节点形状上时也显示手型。
- 两端 Web/Tauri 同步修改。

验证：两端 `pnpm typecheck`、`pnpm lint`、`pnpm format:check` 通过。

### AI助手折叠图标（2026-09-05）

用户报告：AI助手始终占据侧栏空间，干扰编辑视图。

修复：两端 `components/panels/AiAssistant.vue` 改造为可折叠组件。

设计：

- 默认折叠状态，仅显示一个 🤖 圆形图标按钮（36×36px）。
- 点击图标展开完整面板（标题、textarea、按钮、回答区）。
- 展开时面板顶部新增关闭按钮按钮（✕）可一键收起。
- 图标按钮使用 `aria-expanded` 保证可访问性。
- 折叠时不占据侧栏空间（仅图标本身约 52px 高度，含边距）。
- 展开/折叠过渡使用 CSS `transition: background 0.15s`，无闪烁。
- 圆角 50% 的图标按钮在折叠态悬浮/激活时使用强调色，作为"打开"提示。
- 两端 Web/Tauri 同步实现。

实现状态：折叠状态是局部 ref，不持久化。用户期望"默认折叠、点开、收起"。

i18n 新增键：

- `ai.expand`：图标按钮的悬浮提示。
- `ai.collapse`：面板内关闭按钮提示。

四语言全部同步。

验证：两端 `pnpm verify` 通过（Tauri 42 tests，Web 35 tests）。

### AI浮动按钮 + 抽屉（2026-09-05）

用户报告：AI助手即使折叠为图标仍占用侧栏空间，且仅在编辑器页可见。应悬浮在整个页面右下角，可拖动，点击从右侧抽屉打开。

修复：两端 `components/panels/AiAssistant.vue` 重写为浮动按钮 + 右侧抽屉；从 `views/EditorView.vue` 移到 `App.vue` 使所有路由可用。

设计：

- **悬浮按钮 (FAB)**：44×44px 圆形，初始位置右下角 (16px 边距)。
  - 拖动：使用 `pointerdown/move/up` 实现，避免鼠标/触屏差异。
  - 4px 拖动阈值区分"拖动"与"点击"，避免误触。
  - 边界裁剪：不超出可视区域，FAB_MARGIN=16 保护。
  - 拖动时光标变 `grabbing`，盒子阴影加深。
- **抽屉**：固定右侧，宽度 380px，从右侧滑入 (transform: translateX)。
  - 包含标题、textarea、ask/cancel/apply 按钮、回答区。
  - 抽屉打开/关闭 0.2s `ease-out` 过渡。
- **编辑器侧栏**：移除 AiAssistant 后，Properties 占满整个 320px 侧栏，更适合编辑节点。
- **键盘可达**：FAB 支持 Enter/Space 切换；`aria-expanded`、`aria-hidden`、`role="dialog"` 已就位。
- **图标按钮 z-index**：9000，确保悬浮在任何路由内容之上。

i18n 复用 `ai.expand`、`ai.collapse`（上一轮已加）。

验证：两端 `pnpm verify` 通过（Tauri 42 tests，Web 35 tests）。

仍需人工确认：

- FAB 在 Tauri 窗口尺寸变化下位置自适应（仅在初始化时设置，拖动后不重新计算，未来可加入窗口resize监听）。
- 拖动跨 DPI 缩放坐标精度。

### FAB 初始位置闪烁修复（2026-09-05）

用户报告：AI图标首次渲染出现在左上角 (0, 0)，点击后才跳到右下角。

根因：`fabLeft` 和 `fabTop` 默认为 `ref(0)`，初始化函数 `placeFabBottomRight()` 仅在 `onFabPointerDown` 中调用，所以首次渲染时按钮在 (0, 0)，首次点击时才更新到右下角。

修复：两端 `components/panels/AiAssistant.vue` 同步计算 FAB 初始位置：

```typescript
const fabLeft = ref(Math.max(0, window.innerWidth - FAB_SIZE - FAB_MARGIN));
const fabTop = ref(Math.max(0, window.innerHeight - FAB_SIZE - FAB_MARGIN));
```

并删除多余的 `placeFabBottomRight()` 函数与 `initialized` 标志，因为现在初始化发生在 setup 阶段。

验证：两端 `pnpm typecheck`、`pnpm lint`、`pnpm test` 通过（Tauri 42 tests，Web 35 tests）。

### 节点高亮 + 双击内联编辑（2026-09-05）

用户报告两点：

1. 选中节点背景色太暗、不够明显。
2. 双击节点应该直接编辑文本，而不是弹原生 prompt。

**修复 1：选中高亮**

markmap 0.18 默认 `--markmap-highlight-node-bg: #ff02`（4位 hex 即 `#ff000002`，0.78% 透明度），实际近乎不可见。覆盖 CSS 变量使高亮明显：

```css
.canvas > svg :deep(.markmap) {
  --markmap-highlight-node-bg: rgba(59, 130, 246, 0.28);
}
.canvas > svg :deep(.markmap-dark .markmap) {
  --markmap-highlight-node-bg: rgba(96, 165, 250, 0.32);
}
.canvas > svg :deep(.markmap-highlight rect) {
  stroke: var(--accent);
  stroke-width: 1.5;
  rx: 4;
  ry: 4;
}
```

说明：markmap 内部 CSS 通过 `<style>` 节点注入到 SVG，自定义 CSS 通过 `:deep()` 选择器穿透 scoped。亮/暗主题分开调透明度。

**修复 2：双击内联编辑**

把 `promptRename()` 中的 `window.prompt` 替换为内联 `<input>` 覆盖在节点上：

- 通过 `querySelectorAll('g.markmap-node')` 找到对应节点的 SVG `<g>`，使用 `getBoundingClientRect()` 获取屏幕坐标。
- 在该坐标处显示 `<input>`，自动聚焦并全选。
- Enter 应用并提交；Escape 取消；blur 取消。
- 边界处理：测量坐标为 0 时回退到屏幕中心。

```typescript
function startInlineEdit(id: string): void {
  const node = findNode(store.doc.root, id);
  if (!node) return;
  const rect = measureNode(id);
  inlineEdit.value = { id, text: node.text, ...rect };
  void nextTick(() => {
    inlineInputRef.value?.focus();
    inlineInputRef.value?.select();
  });
}
```

样式：

```css
.inline-edit {
  position: fixed;
  z-index: 1000;
  margin: 0;
  padding: 2px 6px;
  font: inherit;
  background: var(--bg);
  color: var(--fg);
  border: 2px solid var(--accent);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  outline: none;
}
```

修改文件：两端 `components/editor/MindEditor.vue`。
依赖：复用 `core/tree.ts::findNode`，未引入新依赖。

验证：两端 `pnpm verify` 通过（Tauri 42 tests，Web 35 tests）。

仍需人工确认：

- markmap 高亮 box 是否与节点文本的圆角矩形重叠对齐（markmap 0.18 的高亮 rect 边距为 4/k，使用了 `rect.x -= s` 微调，可能在缩放时略微错位）。
- 内联编辑器在 markmap zoom/pan 状态下，如果用户在编辑期间触发 pan，编辑器不会跟随节点位置（仅在 dblclick 时刻锁定坐标）。
- 增加 Tauri Driver/WebdriverIO 原生 E2E。

### 回退双击内联编辑、简化选中样式（2026-09-05）

用户反馈：

1. 双击后输入框没有插入光标，无法编辑文本（focus 时机竞态）。
2. 设计本意：重命名通过右键菜单触发，不需要双击内联编辑。
3. 选中时不应再有边框（与重命名时 input 边框重复）。

修复：两端 `components/editor/MindEditor.vue` 回退到精简版：

- 删除 `inlineEdit`/`inlineInputRef` ref 与相关状态。
- 删除 `startInlineEdit`、`focusInlineInput`、`commitInlineEdit`、`cancelInlineEdit`、`findNodeText`、`onInlineInputKey`、`measureNode` 等函数。
- 删除 `findNode` import（不再需要）。
- 删除 `watch(inlineEdit)`。
- 删除 `onSvgDblClick` 监听与对应函数。
- 删除模板中 `<input v-if="inlineEdit">`。
- 恢复 `promptRename()` 使用 `window.prompt`（右键菜单触发）。
- 删除 `.inline-edit` 相关 CSS。
- 简化 markmap 高亮 CSS：只覆盖背景色变量，删除 `.markmap-highlight rect` 的 stroke 边框。

Web 端修复 `exportSvg`/`exportPng` 多余的第三个参数（Web 版 `core/file.ts` 未实现 title 参数）。

验证：两端 `pnpm verify` 通过（Tauri 42 tests，Web 35 tests）。

新交互契约：

- 左键点击：选中节点（仅淡色背景填充，无边框）。
- 右键节点：弹出上下文菜单；"重命名"项调用 `window.prompt`。
- 双击：不再特殊处理。

### 快捷键说明页 + 全局 Mod+/ 快捷键（2026-09-05）

为对齐 legacy 项目的 `Ctrl+/` 弹出快捷键对话框，改为**路由页面 + 顶栏入口 + 全局快捷键**：

**新增文件**

- `views/ShortcutsView.vue`（两端）：按 4 组展示所有快捷键
  - 历史：撤销/重做（Mod+Z/Y/Shift+Z）
  - 节点操作：Tab/Shift+Tab/Enter/F2/Delete/方向键/Alt+↑↓/Space/Mod+点击/Mod+C/X/V/F/B/I/Shift+Enter
  - 视野控制：拖动/右键拖动/滚轮/Mod+滚轮/触摸板/双击空白
  - 布局：Mod+Enter 居中根节点、Mod+0 整理布局

**路由**

- `router/index.ts` 新增 `/shortcuts` 路由（meta.title: 'Shortcuts'）。

**导航入口**

- `AppHeader.vue` 在设置/关于之间插入"快捷键"按钮。

**全局快捷键**

- `App.vue` 在 `onMounted` 注册 `keydown` 监听：

  ```ts
  function onGlobalKeydown(e: KeyboardEvent) {
    if (e.key !== '/') return;
    const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
    if (!mod) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    e.preventDefault();
    void router.push('/shortcuts');
  }
  ```

- 路由跳转而不是打开模态，复用现有 SPA 架构。
- 输入框/textarea/contentEditable 中不触发，避免误触。

**i18n 新增**

- `menu.goShortcuts`（4 语言）
- `shortcut.hint` 提示 macOS/Windows/Linux 平台 `Mod` 差异

**验证**

- 两端 `pnpm verify` 通过（Tauri 42 tests，Web 35 tests）
- 提交：`c46a6ef feat: 新增快捷键说明页与全局Mod+/快捷键`

**未实现/已知差异**

- ShortcutsView 纯模板（数据驱动自 `groups` 数组），当前项目无 `@vue/test-utils`，未补组件测试。
- 描述中的快捷键包括了一些 markmap/kityminder 历史遗留（如 F2 插入父节点、Mod+B 加粗），当前 store 未实现，UI 仅展示。
- 按 `command.addChild` 等键名可后续统一到 `useShortcuts` composable 的注册表，由一处定义后供 ShortcutsView 和快捷键注册复用。

### 快捷键注册表统一 + 组件测试（2026-09-05 收尾）

上节三项"未实现/已知差异"已全部补完：

1. **抽出 `core/shortcuts.ts` shortcutRegistry**（两端）
   - `SHORTCUT_REGISTRY`：每项含 `id`/`section`/`descKey`/`keys`/`status`
   - `SHORTCUT_SECTIONS`：history / node / scope / layout 顺序
   - `status: 'ready'`（已绑定）与 `'todo'`（仅展示、灰显 + 标注"待实现"）
2. **ShortcutsView 改用 registry**：数据驱动渲染，不再本地硬编码；`todo` 项灰色 + `(待实现)` tag
3. **useShortcuts 新增 `bindById` / `bindEntry`**：从 registry 展开键位组合绑定；MindEditor 改用 `bindById`
4. **实现可低成本快捷键**
   - `Mod+Enter` → markmap `fit()`（居中根节点）
   - `Mod+F` → 聚焦左侧搜索框（新 composable `useSearchFocus.ts` + Properties 注册）
   - `Alt+↑/↓` → 新增 store action `reorderNode(id, 'up'|'down')`
   - 越界/根节点操作不入命令栈（修复 undo 状态污染）
5. **安装 `@vue/test-utils` 2.5.0 + 补测试**
   - `src/tests/shortcuts.spec.ts`：4 测试（4 分组、registry 行数一致、todo 标注、kbd 渲染）
   - `mindmap-store.spec.ts` 新增 reorderNode 测试
   - vitest.config.ts 需要 vue() plugin；`@vitejs/plugin-vue@^5` 与 vitest 2.x 内置 vite 5 冲突 → 配置 `plugins: [vue() as never]`
6. **remaining todo 快捷键**（仍仅展示不绑定）：Enter 加兄弟 / F2 加父 / Space 折叠 / Mod+C/X/V 剪贴板 / Mod+B/I 加粗斜体 / 方向键导航 / Shift+Enter 换行 / Mod+0 布局 / Mod+A 全选
7. 修复 intlify 测试警告（shortcuts.spec 测试 messages 补 `newline` key）

**验证**：Tauri 48 tests、Web 40 tests 全通过，无 intlify 警告。提交 `f01a801 修复部分样式错位，新增快捷键页面`。

### .km 原生导出（2026-09-05 继续 legacy 对齐）

用户选择下一步实现 "导出 .km 原生格式"（legacy/百度脑图兼容）：

- `core/km.ts`（两端）新增 `toKmJson(root)`：MindNode → KityMinder JSON 文本
  - `{ root: { data, children }, template: 'filetree', theme: 'fresh-blue' }`
  - meta 扩展字段保留；text/note 以当前模型为准
  - 叶子节点省略 children
- `core/file.ts`（两端）新增 `exportKm(content, suggestedName, title?)`
  - Tauri：保存对话框 .km + tauriWriteFile
  - Web：downloadBlob application/json
- `components/editor/MindEditor.vue`（两端）导出区新增 "导出 KM" 按钮，`exportKm(toKmJson(store.doc.root), '{root}.km')`
- i18n：8 locale 新增 `toolbar.exportKm`；Tauri 4 locale 新增 `dialog.exportKm`（对话框标题）
- Tauri 新增 `tests/km.spec.ts`（此前仅 Web 有）；Web 扩充 round-trip 测试
  - 4 tests：导入、round-trip 保层级与 meta、叶子省略 children、非法输入拒绝
- 验证：Tauri 52 tests、Web 42 tests 全通过

### 快捷键真正可用化（2026-09-05 用户确认"仅有页面无实际绑定"）

原 SHORTCUT_REGISTRY 大量项为 `todo` 仅展示。现已把可低成本实现的全部补为可用（status: ready）：

**新增 store actions（两端 `stores/mindmap.ts`）**

- `addParent(id, text)`：把选中节点包进新父节点（F2 触发），返回新父 id
- 内部剪贴板（非系统剪贴板，模块内 clone 缓存）：
  - `copyNode(id)` / `cutNode(id)`（copy+remove）/ `pasteNode(parentId?)`
  - paste 会**重贴整棵子树 id**（relabelSubtree），避免同文档重复 id 造成选中错乱
- `moveSelection(dir)`：'parent'|'firstChild'|'prev'|'next' 方向键盘导航

**useShortcuts 键归一化**

- `normalizeKey()` 把展示符号 ↑/↓/←/→ 映射为 KeyboardEvent 的 ArrowUp 等；Space → ' '
- `parseShortcut()` 返回前统一 normalize

**MindEditor.bindById 现在绑定（全部实际生效）**

- ready：undo / redo / indent / outdent / removeNode(Delete) / reorder(Alt+↑↓) / placeRoot(Mod+Enter→fit) / findNode(Mod+F→聚焦搜索) / **addSibling(Enter)** / **addParent(F2)** / **copy/cut/paste(Mod+C/X/V)** / **expandCollapse(Space→toggleNode)** / **navigate(↑↓←→)**

**registry 状态**

- todo 保留项：selectAll(Mod+A)、bold(Mod+B)、italic(Mod+I)、newline(Shift+Enter)、layoutInOrder(Mod+0)、dblClickSpace —— 需要富文本/多选/布局算法支持，未低成本实现

**测试**

- `mindmap-store.spec.ts`（两端）新增 3 项：addParent 包裹、copy/cut/paste（deep clone + 重贴 id）、moveSelection 导航
- 验证：Tauri 55 tests、Web 45 tests 全通过

## 8. 常用验证命令

前端（两个工程分别执行）：

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

在 DSH 文件沙箱中，Vitest/Vite 可能因 esbuild 子进程 `spawn EPERM` 失败。已验证使用 `danger-full-access` 后可以运行；不要将该错误误判为断言失败。

Rust：

```powershell
cd tauri-spike/src-tauri
cargo fmt -- --check
cargo check
cargo test
cargo clippy --all-targets -- -D warnings
```

Tauri 无 bundle 调试构建：

```powershell
cd tauri-spike
pnpm exec tauri build --debug --no-bundle
```

如果 executable 被运行中进程占用，可先确认进程来源，或使用独立 target：

```powershell
$env:CARGO_TARGET_DIR='target-verify'
cargo build --bin desktop-naotu
```

`pnpm exec tauri info` 在当前 pnpm 11 环境可能因 Tauri CLI 版本解析 bug 自身 panic；这不是应用配置错误。

## 9. 接手原则

- 先用最新 executable 做 GUI 验收，再继续增加功能。
- 不要重复实现已经存在的 save/search/KM/AI/MCP。
- 发现 Web/Tauri 前端差异时必须同步修复并分别测试。
- 不要删除 `legacy/`，但也不要在其中开发。
- 不要擅自终止用户正在使用的 release/debug 实例；先检查路径和 PID。
- 正式发布前必须重建 installer，旧 MSI/NSIS 不包含所有最新修复。

## 10. 历次功能盘点与完成记录（S1-S5 已全部完成）

> 说明：以下 S1-S5 均已在 2026-09-05 实现并验证（每项下方有"完成记录"）。
> 本节保留完整过程记录供回溯；当前代码状态请优先看文首"近期归档快照"。

### 推荐执行顺序

#### S1：设置“最近文件数量”（最推荐，预计小改动）

现状：

- `stores/config.ts` 已有 `recentMaxNum`，默认值为 5。
- `addRecentFile()` 已按该值截断列表。
- 设置页没有修改该值的控件。

建议实现：

- 在 `SettingsView.vue` 添加数字 input 或 stepper，限制合理范围（建议 1-20）。
- `loadConfig()` 对持久化值做整数与范围校验，不能只判断 `typeof number`。
- 降低上限后立即裁剪已有 `recentFiles`。
- 四个 locale 同步增加标签。
- 两端同步修改并增加 config store 测试。

预计涉及：`stores/config.ts`、`views/SettingsView.vue`、四语言 JSON、测试。无需 Rust/Tauri command。

#### S1 完成记录（2026-09-05）

“最近文件数量”已实现并验证：

- 两端 `stores/config.ts` 新增 `RECENT_FILES_MIN=1`、`RECENT_FILES_MAX=20` 和 `normalizeRecentMaxNum()`。
- 加载持久化值和 `save()` 时统一规范为 1-20 的整数。
- Tauri 端降低上限时会立即裁剪现有 `recentFiles`。
- 两端 `SettingsView.vue` 已增加 number input，范围 1-20、step 1。
- 四语言已增加 `settings.recentMaxNum` 与 `settings.recentMaxNumHint`。
- 两端新增 `src/tests/config.spec.ts`。
- 验证：Tauri `pnpm verify` 通过（38 tests）；Web `pnpm verify` 通过（34 tests）。

本项状态：**完成**。下一项为 S2。

#### S2：状态栏显示当前文件（小改动）

现状：Tauri store 已有 `documentPath`，状态栏只显示文档标题、节点数、dirty。

建议实现：

- 桌面端状态栏显示当前文件名；hover title 显示完整路径。
- 未保存文档显示本地化的“未命名”。
- Web 端没有稳定路径，可只显示文档标题或保持现状；不要伪造路径。

预计涉及：Tauri `AppStatusBar.vue` 和四语言 JSON。无需改 core/store。

#### S2 完成记录（2026-09-05）

桌面状态栏当前文件显示已实现：

- `tauri-spike/src/components/layout/AppStatusBar.vue` 显示当前 basename。
- hover `title` 显示完整 `documentPath`。
- 无路径时显示本地化“未命名文档”。
- Tauri 四语言新增 `statusbar.currentFile` 与 `statusbar.untitledDocument`。
- Web 端没有可靠路径，按设计未伪造文件信息。
- 验证：Tauri `pnpm verify` 通过（38 tests）。

本项状态：**完成**。下一项为 S3。

#### S3：桌面窗口标题同步文档名和 dirty（小到中等）

建议标题格式：

```text
* 文档名 · DesktopNaotu
```

注意：

- dirty 时加 `*`，保存后移除。
- 有路径时使用 basename，无路径时使用根节点文本或本地化“未命名”。
- 动态 `editor-*` 窗口也要生效。
- 使用 Tauri `getCurrentWindow().setTitle()` 前检查 capability 是否需要 `core:window:allow-set-title`。
- 浏览器端仍使用 `document.title`。

预计涉及：`App.vue` 或专用 composable、capability、四语言和测试。

#### S3 完成记录（2026-09-05）

桌面窗口标题与 dirty 标记已实现：

- 新增纯函数 `tauri-spike/src/core/document-title.ts`。
- 新增 `tauri-spike/src/tests/document-title.spec.ts`，覆盖 Windows/POSIX basename、未命名回退和 dirty 星号。
- Tauri `App.vue` 监听 `documentPath`、根节点文本、`isDirty` 和语言；同步 `document.title` 与 native window title。
- 标题格式为 `* 文件名 · DesktopNaotu`，保存后移除 `*`。
- `main` 与 `editor-*` capability 新增 `core:window:allow-set-title`。
- 验证：Tauri `pnpm verify` 通过（41 tests），`pnpm build` 通过，Rust `cargo check` 通过。

本项状态：**完成**。仍需在新 GUI 构建中人工确认 Windows 标题栏显示。下一项为 S4。

#### S4：AI 请求超时与取消（小到中等）

现状：`AiAssistant.vue` 直接 `fetch()`，没有 timeout/cancel；请求卡住时按钮持续 loading。

建议实现：

- 每次请求创建 `AbortController`。
- 增加 30-60 秒 timeout。
- loading 时显示取消按钮。
- 组件卸载时 abort。
- 区分用户取消、超时和网络错误的 Toast。
- 两端同步，四语言同步，补纯 helper 或组件测试。

#### S4 完成记录（2026-09-05）

AI 请求超时与取消已在 Web/Tauri 两端实现：

- 30 秒后自动 abort，并显示本地化超时提示。
- loading 时显示“取消请求”按钮。
- 用户取消显示信息提示，不当作网络错误。
- 组件卸载时自动 abort。
- 每次请求在 `finally` 清理 timer/controller/loading。
- `core/ai.ts` 新增 `classifyAiRequestFailure()`，区分 cancelled/timeout/error。
- 四语言新增 `ai.cancel`、`ai.cancelled`、`ai.timeout`。
- 两端 `ai.spec.ts` 增加错误分类测试。
- 验证：Tauri `pnpm verify` 通过（42 tests）并生产构建通过；Web `pnpm verify` 通过（35 tests）并生产构建通过。

本项状态：**完成**。仍需用真实慢响应 endpoint 人工检查按钮和 Toast。下一项为 S5。

#### S5 完成记录（2026-09-05）

用户可见硬编码文本已清理：

- `stores/mindmap.ts` 移除 `addChild/addSibling` 中文默认参数；调用方传入 `t('node.defaultName')`。
- `core/file.ts` 新增 `title` 参数；`exportSvg/exportPng/saveFile/openFile` 不再硬编码对话框标题。
- `core/file.ts` (Web) 用 `description` 参数替代硬编码 “Markdown 思维导图”。
- `stores/mindmap.ts` `saveAs/open` 接收可选 title/description 参数并透传。
- `App.vue` “Tauri 启动信息获取失败” 改用 `t('app.tauriStartupFailed')`。
- `SettingsView.vue` placeholder 改用 i18n（`settings.savePathWeb/aiEndpointPlaceholder/aiModelPlaceholder`）。
- 四语言共 8 个 locale 文件新增 `node.defaultName`、`dialog.*`、`app.tauriStartupFailed`、`settings.savePathWeb`、`settings.aiEndpointPlaceholder`、`settings.aiModelPlaceholder`。
- 顺手修复 Web 端 4 个 locale 中重复的 `defaultPrompt` key。

本项状态：**完成**。仍需在新 GUI 构建中人工确认 Tauri 对话框标题显示正确语言、Siri 替代位置不存在。

#### S5：清理用户可见硬编码文本（中等，适合拆批）

已发现：

- `stores/mindmap.ts` 默认节点文本 `'新节点'`。
- `core/file.ts` 的“导出 SVG/PNG”“保存脑图”“打开脑图”。
- `App.vue` 的“Tauri 启动信息获取失败”。
- `SettingsView.vue` 的 Web 阶段 placeholder。

建议先处理组件中的硬编码；文件对话框标题应通过调用参数传入本地化文案，不要让纯 core 直接依赖 vue-i18n。

### 盘点中确认已完成，不要重复实现

- 最近文件打开失败时自动移除：`stores/mindmap.ts::openRecent()` catch 已调用 `config.removeRecentFile(path)`。
- 最近文件最大数量截断逻辑已存在，只缺 UI 与更严格校验。
- 页面浏览器标题已有 router 基础逻辑，但还没有桌面文档标题/dirty 同步。

### 暂不归类为简单功能

以下事项会跨 Rust、权限或发布系统，不应在小额度下仓促开始：

- 自动备份保留与清理：当前只有 `copy_file`，没有安全目录枚举/删除命令。
- 自定义 confirm/prompt dialogs：会影响退出拦截、删除、重命名多个交互点，需要统一设计。
- MCP 实时桌面同步与鉴权。
- OS 凭据管理器保存 API key。
- 自动更新、代码签名、三平台 CI。
- Web/Tauri 共享 package 重构。

### 下一位 AI 的最小可交付建议

优先实现 S1“最近文件数量设置”。这是已有配置能力的 UI 闭环，风险最低、可单独验证。每完成一个功能后：

1. 立即更新本节，标明修改文件和验证结果。
2. Web/Tauri 两端同步时分别执行 `pnpm verify`。
3. 不要等多个功能一起完成后才更新交接。

---

## A1 完成记录（2026-09-06）

两端源码一致性审计 + 防漂移护栏，已实现并验证。

### 目标一句话

把 6 处"事故漂移"的共享文件收敛到逐字节一致（Tauri 为功能更新、更全的一方，作为基准），
把 7 处"合理差异"文件记录原因并排除在必须一致集合之外，再新增 parity 护栏脚本并接入两端 `verify`，
防止后续同步改动再次双份返工/漏同步。

### 修改文件清单

**事故已收敛（Tauri → Web 复制，两端现已逐字节一致）**

- `src/components/panels/OutlineTree.vue`：Tauri 新增 `:title` 节点提示。
- `src/components/panels/Properties.vue`：样式细节 / `font:inherit` / 空行对齐。
- `src/core/ai.ts`：注释与文档风格同步。
- `src/core/km.ts`：Tauri 重构出的 `childrenOf` / `textOf` / `convertNode(value, isRoot)` + 根节点校验。
- `src/core/mcp.ts`：Tauri 超集（`McpRequest` / `parseMcpRequest` / tools-call 与更丰富错误信息）。
- `src/components/editor/MindEditor.vue`：导出调用传 `t('dialog.exportSvg/Png/Km')` 标题第 3 参。

**Web 适配修补（让收敛后的 MindEditor 编译/引用一致，非行为漂移）**

- `mindmap-vue3/src/core/file.ts`：`exportSvg/exportPng/exportKm` 增加忽略的第 3 参 `title`
  （默认文案，`eslint-disable` 未用参），保持与 Tauri 签名一致。
- `mindmap-vue3/src/i18n/locales/{zh-CN,en,zh-TW,de}.json`：补 `dialog.exportSvg/exportPng/exportKm`。

**合理差异（已记录原因，parity 排除，不抹平）**

- `App.vue`、`env.d.ts`、`core/file.ts`、`components/layout/AppStatusBar.vue`、
  `components/panels/Toolbar.vue`、`stores/config.ts`、`stores/mindmap.ts`，
  以及目录 `i18n/locales/`、`tests/`。逐条理由写在 `scripts/check-frontend-parity.mjs` 的
  `EXCLUDED_PATHS` 注释里（桌面壳/菜单/MCP/autosave、`__TAURI__` 声明、file.ts 按设计
  Web=FS Access 而 Tauri=路由壳、desktop 状态栏/最近文件 UI 与文档路径状态）。

**护栏脚本与接线**

- 新增 `scripts/check-frontend-parity.mjs`（Node 内置，Windows 路径安全，CRLF 归一化比较）。
- 两端 `package.json`：新增 `parity` 脚本，`verify` 前置调用。

### 验证结果（两端 test 数）

- Web `mindmap-vue3` `pnpm verify` 通过：8 个测试文件 / **45 tests** 全绿。
- Tauri `tauri-spike` `pnpm verify` 通过：8 个测试文件 / **55 tests** 全绿。
- parity：收敛后返回 0（比较 29 个共享文件全部一致；允许差异 18 个）。
- 护栏自测：故意改坏 Web `core/tree.ts` → parity 非零失败并列出该文件；还原后返回 0。
- 注：vitest 在受限沙箱下因 esbuild spawn EPERM 需全权限运行，属运行环境限制与代码无关；
  typecheck / lint / format:check 均绿。

### 仍需人工确认

- 本项纯同步，无行为改动；无需 GUI 逐项复核。可在后续最终 build 的 GUI 中抽查
  导出 SVG/PNG/KM 对话框标题按当前语言正确显示即可。

本项状态：**完成**。下一项 **A2**（用项目 dialogs 替换 `window.prompt/confirm`）。

---

## A2 完成记录（2026-09-06）

用项目 Promise 式 dialogs 替换全部 `window.prompt/confirm`，兑现 AGENTS 红线 #7。

### 目标一句话

新增 `components/dialogs/`（Confirm/Prompt）+ 全局单例 `useDialog()`，由 App 根挂载
`<DialogHost/>`，把散落在 App.vue / Properties.vue / MindEditor.vue 的原生弹窗全部改走
Promise 式调用，并两端各补一套组件测试；`window.(prompt|confirm|alert)` 代码调用清零。

### 修改文件清单（均为两端同步；App.vue 因平台差异仅各自改脚本，共享组件逐字节一致）

- 新增（两端相同）：
  - `src/components/dialogs/ConfirmDialog.vue`：标题/正文/确定/取消，`role="dialog"` +
    `aria-modal`，Esc=取消、Enter=确认，danger 时自动聚焦"取消"（安全按钮），Teleport body，
    简单 Tab 焦点圈闭 + 焦点回还。
  - `src/components/dialogs/PromptDialog.vue`：确认 + 单行输入，初值回填并全选，
    Enter 提交 / Esc 取消，Teleport body。
  - `src/components/dialogs/DialogHost.vue`：订阅 useDialog 单例 request，按 kind 渲染
    Confirm/Prompt 并把选择 settle 回 Promise；渲染错误经 `failDialog` 拒绝。
  - `src/composables/useDialog.ts`：模块级单例 `confirm(): Promise<boolean>`、
    `prompt(): Promise<string|null>`；payload 用 kind 判别便于 TS 收窄。
- 接线：两端 `src/App.vue` 根模板加 `<DialogHost/>`。
- 替换调用点：
  - Tauri `App.vue` `confirmDiscard()`：`window.confirm` → `await dialog.confirm(...)`
    （保留 onCloseRequested/菜单的异步拦截与 `isDirty` 短路语义）。
  - 两端 `Properties.vue` `removeSelected()`：删除节点确认 → `dialog.confirm`（danger）。
  - 两端 `MindEditor.vue`：右键重命名 `window.prompt` → `dialog.prompt`；右键删除
    `window.confirm` → `dialog.confirm`（danger）。删除快捷键路径（无确认）保持不变。
- 测试（两端）：`src/tests/dialog.spec.ts` 7 例——confirm 确定=true / 取消=false /
  Esc=false；danger 文案与单例渲染唯一；prompt 提交=输入值（初值回填）、Enter 提交、
  Esc=null。

### 验证结果（两端 test 数）

- Web `mindmap-vue3` `pnpm verify` 通过：9 个测试文件 / **52 tests**（原 45 + 新增 7）全绿。
- Tauri `tauri-spike` `pnpm verify` 通过：9 个测试文件 / **62 tests**（原 55 + 新增 7）全绿。
- parity：返回 0（新增 useDialog+3 个 dialogs 使共享比较升至 33 个文件，全部一致）。
- grep `window.(prompt|confirm|alert)`：仅剩注释里的"替代 window.xxx"说明，代码调用为 0。

### 仍需人工确认

- 需在 GUI 中复核：右键重命名/删除弹窗、属性面板删除节点弹窗、桌面端退出/新建/打开
  前的"丢弃修改"确认，均显示为自定义对话框且按当前语言文案正确；确认后默认焦点行为合理；
  Esc/Enter 键操作符合预期。此点需用户在运行中的实例里人工点验，未在本次标为已完成。

本项状态：**完成（代码与自动化测试）**，GUI 人工点验待用户进行。下一项 **A3**（Vite 代码分割）。

---

## A3 完成记录（2026-09-06）

Vite 代码分割，消除 >500 KiB chunk 告警并改善首屏。

### 目标一句话

两端 `vite.config.ts` 增加 `manualChunks` 手动分桶（vue-vendor / markmap / markmap-md / d3 /
vendor），配合已就位的路由动态 `import()`，把单入口大 bundle 拆成若干 <500 KiB 的稳定 chunk。
Tauri 端沿用 `base './'`，懒加载 chunk 仍按相对路径产出。

### 修改文件清单

- `mindmap-vue3/vite.config.ts`：新增 `build.rollupOptions.output.manualChunks`。
- `tauri-spike/vite.config.ts`：同上，并入既有 `build` 块；`base './'` 不变。
- 路由懒加载无需改动：两端 `src/router/index.ts` 已一致，且 Editor/Settings/Shortcuts/
  About/NotFound 全部用 `component: () => import(...)`（A1 parity 已验证逐字节一致）。

### manualChunks 说明

- pnpm 真实路径形如 `node_modules/.pnpm/<pkg>@x/node_modules/<pkg>`，故取**最后一个**
  `/node_modules/` 后的包名，并先把 Windows 反斜杠归一为正斜杠，否则会把整段 .pnpm 误并进
  一个 `vendor`（首次实现曾因此仍产出 840 KiB 单 chunk，已修正）。
- 分桶：`vue-vendor`(vue/vue-router/pinia/vue-i18n/@vue)、`markmap`(markmap-*)、
  `markmap-md`(katex/highlight.js/markdown-it*)、`d3`(d3 及 d3-*)、其余 `vendor`。
  这四类里 markmap-lib 的 Markdown 管线与 markmap-view 的 d3 伞包较重，单独成桶后
  单 chunk 均 <500 KiB。

### 验证结果

- 两端 `pnpm build` 通过，**无 "Some chunks are larger than 500 KiB" 告警**：
  - Web 最大 chunk：markmap-md ~325 kB（另有 vue-vendor 122 / vendor 310 / markmap 28 / d3 52）。
  - Tauri 最大 chunk：markmap-md ~325 kB、vendor ~329 kB（`base './'`）。
- Tauri `dist/index.html` 使用 `./assets/...` 相对引用，并对各 vendor chunk 输出
  `<link rel="modulepreload">`，懒加载路径正常。
- 两端 `pnpm verify` 通过：Web 9 files / **52 tests**，Tauri 9 files / **62 tests**，parity 0。

### 仍需人工确认

- 需在新构建的 GUI 里复核：Web 与 Tauri 页面路由切换正常、刷新/直接进入 /settings、/about、
  /shortcuts 不白屏（懒加载 chunk 相对路径正确）。Tauri 端改动需重新打包后才生效，本项未重打包。

本项状态：**完成（代码与两端 build/verify 验证）**。GUI 路由点验与 Tauri 重打包待用户进行。
下一项按批为 **B3**（桌面原生打磨批内的下一个任务，跨 Rust）。

---

## B1 完成记录（2026-09-06）

原生菜单四语言本地化（动态重建）。已实现并经 cargo/两端 verify 验证；原生菜单即时切换
行为需在 debug 构建中人工冒烟确认。

### 目标一句话

把 Rust 端硬编码英文的系统菜单改为由前端按当前 vue-i18n 语言生成的结构化 spec 动态重建，
使切语言后原生 File/Edit/View/Help/app 菜单立即本地化；菜单项 id 与 `handleMenuEvent`
一一对应保持，行为不变。

### 修改文件清单

- Rust：
  - `tauri-spike/src-tauri/src/commands.rs`：新增 serde spec 结构（按 `kind` 区分子菜单/项/
    分隔线/自定义项），新增 `rebuild_native_menu(app, spec) -> AppResult<()>`（async，
    无 unwrap/expect），角色项（about/quit/undo/redo/cut/copy/paste/select_all/fullscreen）
    用 Tauri `PredefinedMenuItem` 重建以保留 About 元数据与系统语义，自定义项用
    `MenuItemBuilder::with_id(id,label)` + accelerator，成功即 `app.set_menu(...)`；
    补 `impl From<tauri::Error> for AppError`；新增 2 个解析单测。
  - `tauri-spike/src-tauri/src/lib.rs`：注册 `rebuild_native_menu`；默认 `build_menu` 与
    `.on_menu_event`、Cargo 多 binary/default-run 均未改动。
- 前端（Tauri 专用接线）：
  - `tauri-spike/src/core/tauri-file.ts`：新增 `tauriRebuildNativeMenu(spec)` invoke 包装。
  - `tauri-spike/src/App.vue`：`useI18n` 增加 `locale`；`rebuildMenu()` 仅 `platform==='tauri'`
    时 `buildMenuSpec((k)=>t(k))` → invoke；失败 toast.warn 不静默不阻断；`onMounted` Tauri
    块末尾调用一次覆盖默认英文 + `watch(locale)` 即时重建。Web `App.vue` 不调用。
- 共享纯函数（两端逐字节一致，纳入 parity 对比）：
  - `mindmap-vue3/src/core/menu-spec.ts` = `tauri-spike/src/core/menu-spec.ts`：纯 TS，
    `MenuSpec/MenuItemSpec/MenuSubmenuSpec/MenuRole` 类型 + `MENU_LABEL_KEYS` + `buildMenuSpec(t)`
    （t 为注入的字符串解析器，core 不依赖 vue-i18n）。结构与原英文菜单一致：app 菜单
    (About/Quit)、File(New=Ctrl+N/Open=Ctrl+O/Open Recent/New Window/Save/分隔/Quit)、
    Edit(undo/redo/…cut/copy/paste/select_all)、View(toggle-devtools=Ctrl+Shift+D/fullscreen)、
    Help(About)。
- i18n：`tauri-spike/src/i18n/locales/{zh-CN,en,zh-TW,de}.json` 在 `menu.*`/`common.*` 下补
  new/open/newWindow/save/quit/about/undo/redo/cut/copy/paste/selectAll/toggleDevtools/
  fullscreen 等四语言文案。Web locale 无原生菜单，未改。
- 测试：`tauri-spike/src/tests/menu-spec.spec.ts`（结构/ids/accelerator + 用真实四语言 locale
  断言 label 齐全，6 例）；`mindmap-vue3/src/tests/menu-spec.spec.ts`（纯结构，4 例）。

### 验证结果

- parity：`PARITY OK`（34 个共享文件比较一致，含新共享 `core/menu-spec.ts`）。
- 两端 `pnpm verify`：Web **56 tests**（+4）、Tauri **68 tests**（+6）全绿，typecheck/lint/
  format 干净。
- Rust：`cargo fmt -- --check`、`cargo check`、`cargo test`（**7 passed**，原 5 + 新 2）干净；
  `cargo clippy --all-targets -- -D warnings` 干净。

### 仍需人工确认（须 debug 构建冒烟）

- `pnpm dev:tauri` 后打开设置切换语言，确认原生菜单即时本地化、File 项（New/Open/Open
  Recent/New Window/Save）仍触发 `menu_event` → 现有 `handleMenuEvent` 正常分发。
- 平台差异点：macOS 会把首个 app 菜单当系统菜单并可能用 OS 本地化覆盖部分角色项标题；
  Windows/Linux 会把该 app 菜单渲染成最左侧一个带应用名（已本地化）的菜单——与原硬编码
  结构一致。部分角色项（undo/redo/fullscreen）在 Windows/Linux 标 "Unsupported"，同现状。
- 本项未 `tauri build`/重打包 installer，未在运行中的实例里冒烟。

本项状态：**完成（代码 + cargo + 两端 verify/clippy）**，原生菜单即时切换待 GUI 冒烟确认。

---

## CODE_REVIEW Round 3 修复完成记录（2026-09-06）

按 `CODE_REVIEW_2026-09-06.md` 的 P0 → P1 → P2 顺序修复审核问题（P1-4 已在 Round 2 完成）。

### 目标一句话

修复 P0 快捷键修饰键匹配缺陷与 P1/P2 的 i18n 同步与健壮性问题；两端同步并补键盘级与
store 回归测试。

### 修改文件清单（两端）

- `src/composables/useShortcuts.ts`：`matchModifier` 改为修饰键**精确相等**（mod=0 需所有
  修饰键为 false），抽出并导出纯函数 `parseShortcut`/`matchModifier`/`matchShortcut`，
  `onKeyDown` 改走 `matchShortcut`。
- `src/core/shortcuts.ts`：`indent` 的 `descKey` 由误用 `shortcut.insertChild` 修正为
  `shortcut.indent`。
- `src/stores/mindmap.ts`：`removeNode` 在 `applyEdit` 前对"根节点/找不到节点"前置 return
  （不压空撤销命令）；删除无调用方的死代码 `handleKey`（定义 + return 导出）。
- `src/tests/shortcuts.spec.ts`：新增 7 例键盘级匹配（4 组冲突 + 多余修饰键 + parse/matchModifier）。
- `src/tests/mindmap-store.spec.ts`：新增 P2-1 回归（删根/不存在节点不入栈）。
- `src/i18n/locales/{zh-CN,en,zh-TW,de}.json`：`command.*` 补齐（Web +updateNote/reorderNode/
  addParent；Tauri +reorderNode/addParent）。
- 仅 Tauri：`src/i18n/locales/en.json` 补 `node.defaultName`（P1-2）。
- P2-3（scope 分组占位，可选）**有意不处理**：registry 只收键盘绑定，手势说明建议以非快捷键
  说明块呈现（详见 CODE_REVIEW Round 3）。

### 验证结果（两端 test 数）

- parity：`PARITY OK`（34 shared / 0 mismatch）。
- Web `mindmap-vue3` `pnpm verify`：**65 tests（10 files）** 全绿（上轮 56 → +9）。
- Tauri `tauri-spike` `pnpm verify`：**77 tests（10 files）** 全绿（上轮 68 → +9）。
- 未改 Rust，无 cargo 步骤。

### 仍需人工确认（GUI 实机，§1.4 验收）

- Alt+↑/↓ = 重排、Shift+Tab = 左缩进、Mod+Enter = 根节点居中、Ctrl+Shift+Z = 重做；
  英文界面新节点默认文案显示 "New node"。

### 审核师补遗（与本记录合并）

- 修复者提交时 `command.pasteNode` 键在 8 个 locale 文件中均缺失（`store.pasteNode` /
  `cutNode` 仍以此为命令名入栈）。本批审核中发现并补齐：8 个 locale 的 `command` 分组
  各新增 `pasteNode`（zh-CN `粘贴节点` / en `Paste node` / zh-TW `貼上節點` /
  de `Knoten einfügen`）。补齐后 `pnpm verify` 仍全绿（65 / 77 tests，parity 0）。
- 上文测试数 65 / 77 已包含此项补遗；本批亦同此口径。
- 本批未覆盖 P2-3（ShortcutsView scope 分组占位，可选），按"有意不处理"立场。

本项状态：**完成（代码 + 两端 verify）**，键盘与文案 GUI 点验待用户进行。

---

## C3 完成记录（2026-09-06，第二批）

按 `NEXT-PLAN.md §2 C3` 让 ShortcutsView 不再长期空许 `selectAll`/`bold`/`italic`/`newline`/
`dblClickSpace`；同时处理 `layoutInOrder`(Mod+0) 与 `placeRoot`(Mod+Enter) 的重复，
保留 `placeRoot`（语义更准）。

### 目标一句话

把仍未实现的快捷键项的文案统一为"规划中"，删去与 `placeRoot` 冲突的 `layoutInOrder`，
并补齐 `shortcut.indent`/`shortcut.outdent`/`shortcut.statusPlanned` 三组 i18n 键
（其中 `indent`/`outdent` 在 CODE_REVIEW Round 3 报告里声称已补，但实际 8 个 locale
均仍缺，本轮一并补齐）。

### 修改文件清单

- `mindmap-vue3/src/core/shortcuts.ts` + `tauri-spike/src/core/shortcuts.ts`（parity 共享）：
  - `selectAll`/`bold`/`italic`/`newline`/`dblClickSpace` 五项的 `descKey` 由各自独立键
    （`shortcut.selectAll` 等）改为统一指向 `shortcut.statusPlanned`（"规划中"）；
    `status` 字段保持 `'todo'`，由 `ShortcutsView` 既有 todo 渲染逻辑灰显。
  - 删除 `layoutInOrder` entry（保留 `placeRoot`）。
- 两端各 4 个 `src/i18n/locales/{zh-CN,en,zh-TW,de}.json`：
  - `shortcut` 分组补 `indent`/`outdent`/`statusPlanned` 三键；
  - 删除 `layoutInOrder` 键（避免死键）。
  - 文案：
    | key | zh-CN | en | zh-TW | de |
    |---|---|---|---|---|
    | `shortcut.indent` | 向右缩进 | Indent | 向右縮排 | Einrücken |
    | `shortcut.outdent` | 向左缩进 | Outdent | 向左縮排 | Rückgängig machen |
    | `shortcut.statusPlanned` | 规划中 | Planned | 規劃中 | Geplant |
- `mindmap-vue3/src/tests/shortcuts.spec.ts` + `tauri-spike/src/tests/shortcuts.spec.ts`：
  - mock i18n messages 同步增加 `statusPlanned`，删除 `layoutInOrder`；
  - 新增用例 `every registry descKey resolves to a non-key text (no "shortcut.xxx" leak)`：
    遍历 `SHORTCUT_REGISTRY` 每一个 entry 渲染的 `th` 文本，断言不包含原始 key 字符串
    （防止再次出现 "shortcut.layoutInOrder" 之类回退）；同时断言 `layoutInOrder`
    已从 registry 移除、HTML 不再含旧文案。

### 验证结果（两端 test 数）

- parity：`PARITY OK`（34 shared / 0 mismatch）。
- Web `mindmap-vue3` `pnpm verify`：**65 tests（10 files）** 全绿（Round 3 = 64 → +1）。
- Tauri `tauri-spike` `pnpm verify`：**77 tests（10 files）** 全绿（Round 3 = 76 → +1）。

### 仍需人工确认（GUI 实机）

- 在 ShortcutsView 切换四种语言，确认 `selectAll`/`bold`/`italic`/`newline`/`dblClickSpace`
  行均显示"规划中/Planned/規劃中/Geplant"，`indent`/`outdent` 行显示本地化缩进文案；
  `layoutInOrder` 行不再出现。

### P2-3 决定（本轮）

`P2-3`（ShortcutsView scope 分组占位）继续按"可选未做"立场处理：registry 化后 scope
分组只剩 `dblClickSpace` 一项（已统一为 `statusPlanned`），非键盘手势（拖动/滚轮/
触摸板）建议未来以非快捷键说明块呈现。本轮不改动，避免在 `todo`/`planned` 措辞间来回反复。

本项状态：**完成（代码 + 两端 verify）**，语言切换点验待用户进行。




