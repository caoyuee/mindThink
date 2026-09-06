# DesktopNaotu 当前进度与交接

更新时间：2026-09-05

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

## 10. 2026-09-05 简单功能盘点（本轮最新进度）

用户要求后续每项工作都持续归档。本轮只完成代码盘点，没有继续修改业务代码；上一轮节点选择/撤销修复仍是最新业务改动。

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
