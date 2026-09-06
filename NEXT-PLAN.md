# NEXT-PLAN.md — 下一批功能实施计划（交给执行 AI）

> **规划方持续维护**：本文件由规划方在每次 AI 开发者交付后检查并更新。
> 状态字段：`已完成` / `待办` / `设计中（gate）` / `人工门槛`。
>
> **当前基线**（规划方 2026-09-06 19:40 实测）：
> - Web `pnpm verify` = **56 passed**（10 文件，含 `dialog.spec.ts`、`menu-spec.spec.ts`）
> - Tauri `pnpm verify` = **68 passed**（10 文件）
> - 两端 `pnpm parity` = OK（34 shared files，0 mismatch）
> - 两端 `pnpm build` 无 >500 KiB chunk 告警
> - 工作树 clean；HEAD = `d82535f`（A1-A3+B1 + 代码审核 `CODE_REVIEW_2026-09-06.md`）

---

## 0. 当前进度快照

### ✅ 已完成（commit `4b68c22` + 已审核 `d82535f`）

| ID | 名称 | 关键产物 | 验证 |
|---|---|---|---|
| **A1** | 两端源码一致性审计 + 防漂移护栏 | `scripts/check-frontend-parity.mjs`（已挂到两端 `verify` 前面）；共享 34 文件全部一致 | parity OK |
| **A2** | 项目 dialogs 替换 `window.confirm/prompt` | `components/dialogs/{ConfirmDialog,PromptDialog,DialogHost}.vue` + `composables/useDialog.ts`；4 处调用点（App.vue `confirmDiscard`、Properties 删除、MindEditor 重命名/删除）全部清零 | `dialog.spec.ts` 7 用例 |
| **A3** | Vite 代码分割 | 两端 `vite.config.ts` 加 manualChunks：`vue-vendor` / `markmap` / `markmap-md` / `d3` / `vendor` | 无 >500 KiB 告警 |
| **B1** | 原生菜单四语言本地化（动态重建） | `core/menu-spec.ts` 纯函数（输出 `MenuSpecJson`）+ Rust `rebuild_native_menu` command；前端 setLocale 后自动重建 | `menu-spec.spec.ts`（Web 4 / Tauri 6 用例）|

### ⚠️ 代码审核遗留（`d82535f` 登记，必修）

来源：`CODE_REVIEW_2026-09-06.md`。**已确认 `useShortcuts.ts` 未在 `4b68c22` 修改 → P0-1 bug 仍存在。**

| ID | 严重度 | 问题 | 涉及文件 |
|---|---|---|---|
| **P0-1** | P0 | `useShortcuts.matchModifier` 只校验"需要的修饰键按下"、**不排除多余修饰键**，且 `onKeyDown` 按注册顺序首个匹配即 return。导致 `Mod+Enter` → addSibling（应为 placeRoot）、`Alt+↑/↓` → navigate（应为 reorder）、`Shift+Tab` → indent（应为 outdent）、`Mod+Shift+Z` → undo（应为 redo）。两端同源同 bug。 | 两端 `composables/useShortcuts.ts` + 键盘级 spec |
| **P1-1** | P1 | `shortcut.outdent` 在全部 8 个 locale 缺失；`shortcut.indent` 误用 `descKey:'shortcut.insertChild'` | 两端 8 个 `i18n/locales/*.json` |
| **P1-2** | P1 | `tauri-spike/src/i18n/locales/en.json` 缺 `node.defaultName`（英文桌面新增节点回退显示中文）| `tauri-spike/src/i18n/locales/en.json` |
| **P1-3** | P1 | `command.*` 命名键不全：Web 缺 `updateNote/reorderNode/addParent/pasteNode`；Tauri 缺 `reorderNode/addParent/pasteNode` | 两端 locale |
| **P1-4** | P1 | ~~Web `core/km.ts` 未同步~~ → **已确认同步**（两端开头注释一致；负向测试需检查补齐） | 两端 `tests/km.spec.ts`（检查负向用例是否同步）|
| **P2-1** | P2 | `removeNode` 根守卫仍在 `applyEdit` 内部，键盘 Delete 选根节点会推空命令入栈（与 `reorderNode`/`addParent`/`cutNode` 前置守卫原则不一致）| 两端 `stores/mindmap.ts` |
| **P2-2** | P2 | `store.handleKey()` 已无任何调用方，dead code | 两端 `stores/mindmap.ts` |
| **P2-3** | P2 | ShortcutsView "视野控制"分组几乎被清空（registry 化后 `scope` 仅剩 `dblClickSpace` todo 一项）| 两端 `core/shortcuts.ts`（可选占位）|

### ❌ 待办（按依赖排）

| ID | 名称 | 规模 | 跨 Rust? | 依赖 |
|---|---|---|---|---|
| **B2** | 原生菜单 Recent Files 子菜单真正可用 | 中 | 是 | B1（menu-spec 通道）+ **P0-1 必先修**（菜单事件走 useShortcuts 不直接相关，但 P0 影响一致性修复）|
| **B3** | 自动备份保留策略与旧备份清理 | 中 | 是 | 无 |
| **B4** | 设置页 defSavePath 生效 + 日志落盘开关启用 | 中 | 是（部分） | 无 |
| **C1** | MCP 桌面实时桥接 + HTTP 鉴权 + 客户端配置示例 | 大 | 是 | **先出设计文档**（gate）|
| **C2** | API key 迁移到 OS 凭据管理器 | 中-大 | 是 | 先出设计决策 |
| **C3** | 剩余 todo 快捷键裁决（多数需富文本，应诚实标注推迟）| 小 | 否 | **P0-1 必先修**（Mod+0 与 Mod+Enter 重复要靠修复后的匹配去重）|

### 🛑 人工门槛（执行 AI 不做，只提醒）

- P0 GUI 实机回归（特别是快捷键：Alt+↑/↓、Shift+Tab、Mod+Enter、Mod+Shift+Z 四组按审核 §1.4）
- 重新生成安装包 `pnpm build:tauri`
- P1 全桌面验收（中文路径、只读文件、最近文件失效路径、自动备份恢复、多窗口隔离等）
- 不擅自终止用户正在运行的 release/debug 实例；不要把旧 MSI/NSIS 当作新产物

---

## 1. 推荐执行顺序（规划方建议，分批派工）

### 第一批：审核遗留修复 + 廉价裁决（约 3-4 小时）

**执行 AI 必须最先修 P0-1**，否则后续快捷键相关验证失真。

1. **P0-1** useShortcuts 修饰键精确匹配（重写 `matchModifier`，抽纯函数导出，加键盘级 spec）
2. **P1-1** `shortcut.indent` / `shortcut.outdent` × 8 locale
3. **P1-2** tauri-spike en 补 `node.defaultName`
4. **P1-3** `command.{updateNote,reorderNode,addParent,pasteNode}` × 4 locale
5. **P1-4** 核对 km.spec.ts 负向用例两端是否一致（差则补齐；km.ts 代码已同步无需改）
6. **P2-1** `removeNode` 前置守卫（根/不存在不入栈）
7. **P2-2** 删除 dead code `store.handleKey()`（先 grep 两端确认零引用）
8. **P2-3** ShortcutsView scope 占位（可选；不留则文档说明"已收窄"）
9. **C3** todo 快捷键裁决：把 selectAll/bold/italic/newline/dblClickSpace 改 i18n 文案为"规划中"；`layoutInOrder` Mod+0 与 `placeRoot` Mod+Enter 二选一保留（建议保留 Mod+Enter 并在 registry 删 Mod+0）

**完成收尾**：两端 `pnpm verify`；Web → 56+ 用例；Tauri → 68+ 用例；HANDOFF.md 按既有 S1-S5 格式追加"审核遗留修复"小节，登记 P0-1 等完成项。

### 第二批：桌面原生打磨（跨 Rust，可分 1-2 个 AI 跑）

10. **B3** 自动备份保留（独立，可与 B2/B4 并行）
11. **B2** Recent Files 原生子菜单（依赖 B1 menu-spec 通道）
12. **B4** defSavePath + 日志落盘

**完成收尾**：Rust `cargo check/test/clippy`；两端 `pnpm verify`；Tauri 端 `pnpm build:tauri --debug --no-bundle` 冒烟一次（不产包）；HANDOFF.md 追加 B2-B4 完成记录。

### 第三批：能力增强（先设计 gate）

13. **C1** 写 `docs/mcp-live-design.md`（拓扑/鉴权/写链路/多窗口/兼容性/客户端示例）→ **用户确认**
14. **C2** 写 `docs/api-key-storage-design.md`（keyring 选型 + Web 降级 + 安全边界）→ **用户确认**
15. 按 gate 通过的设计文档实现 C1 / C2

---

## 2. 第一批详细规格（执行 AI 直接照做）

### P0-1 — useShortcuts 修饰键精确匹配 + 键盘级 spec

**目标**：修复 4 组按键冲突，约束为"修饰键精确相等"。

**修改**：两端 `src/composables/useShortcuts.ts`
- 把 `matchModifier` 改为**修饰键精确相等**（需求位与事件位逐一相等；`Mod` 在 mac=meta、win/linux=ctrl）。`mod=0` 的条目只在无任何修饰键按下时匹配。
- 把 `parseShortcut` / 匹配逻辑抽成**可单测的纯函数并 export**（建议放 `core/shortcuts.ts` 或 composable 末尾，CONVENTIONS 要求纯逻辑可测）。
- 解决"先注册者先吞"的顺序问题：匹配时遍历候选只命中那些**修饰键相等且 key 相等**的项；若仍有多个候选项，按"修饰键位数更多者优先"或"显式优先级"字段择优。

**测试**：扩展 `src/tests/shortcuts.spec.ts`（或新建 `useShortcuts.spec.ts`），至少覆盖：
- `Mod+Enter` → 命中 placeRoot，不命中 addSibling
- `Alt+↑` → 命中 reorder，不命中 navigate
- `Alt+↓` → 同上
- `Shift+Tab` → 命中 outdent，不命中 indent
- `Mod+Shift+Z` → 命中 redo，不命中 undo
- 正例：纯 `Enter` → addSibling、纯 `Tab` → indent、纯 `↑` → navigate、`Mod+Z` → undo、`Mod+Y` → redo
- 副作用：带多余修饰键的任意组合（如 `Mod+Shift+C`）不应命中 copyNode

**红线**：不动 SHORTCUT_REGISTRY 的 i18n 键；不破坏现有键盘监听器注册/解绑语义。
**验证**：两端 `pnpm verify` 通过；测试全绿。

---

### P1-1 / P1-2 / P1-3 — i18n 同步（一次性收齐）

**目标**：消除 8 locale × 多键缺失。

**P1-1** `shortcut.indent` + `shortcut.outdent`：两端 8 locale 文件 `shortcut` 分组补两键，文案对齐（参考 `shortcut.insertChild`/`shortcut.outdent`/`shortcut.removeNode` 现有风格）：
- `shortcut.indent`: "向右缩进 / Indent / 向右縮進 / Einrücken"
- `shortcut.outdent`: "向左缩进 / Outdent / 向左縮進 / Rückgängig machen"

**P1-2** `tauri-spike/src/i18n/locales/en.json` `node.defaultName: "New node"`（对齐 Web en）。

**P1-3** `command.*` 补齐：
- Web 缺：`updateNote` / `reorderNode` / `addParent` / `pasteNode`
- Tauri 缺：`reorderNode` / `addParent` / `pasteNode`
- 命名风格对齐已有键（`renameNode`/`addChild` 等），文案直接复用动词短语（中文："更新备注" / "重排节点" / "插入父节点" / "粘贴节点"；英文 "Update note" / "Reorder node" / "Insert parent" / "Paste node"；繁/德语同步）。

**验证**：两端 `pnpm verify` 通过；任意 locale 改 fallback 不报错；`ShortcutsView` 行渲染无"原始 key 文本"。

---

### P1-4 — km.spec.ts 负向用例对齐

**目标**：核对 `core/km.ts` 已同步的前提下，测试是否同步。

**操作**：对比 `mindmap-vue3/src/tests/km.spec.ts` 与 `tauri-spike/src/tests/km.spec.ts`，确保 import、round-trip、空根校验、非法输入、叶子省略 children 等用例**两侧覆盖率一致**；若仅一侧有则补齐。

**红线**：不动 km.ts 实现；只对齐测试。
**验证**：两端 `pnpm verify`。

---

### P2-1 — removeNode 前置守卫

**目标**：把根节点守卫从 `applyEdit` 内部上提到函数入口，与 `reorderNode`/`addParent`/`cutNode` 风格一致。

**修改**：两端 `src/stores/mindmap.ts`
```ts
function removeNode(id: string): void {
  if (id === doc.value.root.id) return;
  const parent = findParent(doc.value.root, id);
  if (!parent) return;
  applyEdit((d) => { ... }, 'command.removeNode');
  if (selectedId.value === id) selectedId.value = null;
}
```

**测试**：在 `mindmap-store.spec.ts` 增用例：删除根节点后 `canUndo` 应为 false、`selectedId` 不变。

**验证**：两端 `pnpm verify`。

---

### P2-2 — 删除 dead code `store.handleKey()`

**目标**：清掉 store 上已无引用的 `handleKey()`（旧的 Tab/Delete/Ctrl+Z 分支已被 useShortcuts + 组件内 binding 取代）。

**操作**：
1. 先 grep 两端 `src/**/*.{ts,vue}` 确认无 `handleKey` 引用（确认结果显示"无引用"，再删）。
2. 删除 `src/stores/mindmap.ts` 中 `function handleKey` 实现及 `return { ... handleKey }` 中的导出。
3. 检查 typings/导出是否需要清理。

**红线**：不删 `mindmap-store.spec.ts` 里可能引用 `handleKey` 的旧用例（先确认 0 引用后直接删即可）。
**验证**：两端 `pnpm verify`；grep `handleKey` 两端为 0。

---

### P2-3 — ShortcutsView scope 分组占位（可选）

**目标**：保留"视野控制"分组不空，避免帮助信息倒退。

**方案 A**（推荐最小）：在 `core/shortcuts.ts` 的 `SHORTCUT_REGISTRY` 加 status:'todo' 的占位项，覆盖拖动/右键拖动/滚轮/Mod+滚轮/触摸板/双击空白等手势，keys 留空数组。`ShortcutsView` 现有逻辑（todo 项灰显）会自动渲染。
**方案 B**：在 ShortcutsView 文案里加一句"手势控制详见文档"，不动 registry。

**验证**：两端 `pnpm verify`；`ShortcutsView` 渲染行数增加与 i18n key 同步。

---

### C3 — 剩余 todo 快捷键裁决

**目标**：让 ShortcutsView 不再长期空许 selectAll/bold/italic/newline 这类与已回退的"双击内联编辑"设计冲突的能力。

**修改**：
1. 在 `core/shortcuts.ts` 把以下项 descKey 改为新的 i18n 文案（如 `shortcut.statusPlanned`），并加状态说明或直接 status 改为 `'todo'`（已是 todo）：
   - `selectAll`(Mod+A)、`bold`(Mod+B)、`italic`(Mod+I)、`newline`(Shift+Enter)、`dblClickSpace`
2. 处理 `layoutInOrder`(Mod+0) 与 `placeRoot`(Mod+Enter) 重复：**二选一**。建议保留 `placeRoot`（语义更准），从 registry 删除 `layoutInOrder` 项；同时删 4 locale 的 `shortcut.layoutInOrder` 键（避免死键）。
3. i18n 新键：`shortcut.statusPlanned` = "规划中 / Planned / 規劃中 / Geplant"（4 语言）。

**红线**：不引入富文本/多选能力；不改快捷键注册机制。
**验证**：两端 `pnpm verify`；ShortcutsView 渲染与 registry 一致（`shortcuts.spec.ts` 已覆盖）。

---

## 3. 第二批详细规格（B2 / B3 / B4，跨 Rust）

> 以下各项若引入新 Tauri command，必须按红线三件套：`commands.rs` 定义 →
> `lib.rs` `generate_handler![]` 注册 → `capabilities/default.json` 加权限（如需要）。
> Rust command 必须 `async` + 返回 `AppResult<T>`，禁止 unwrap/expect 于生产路径。
> 红线：自定义 command 默认允许调用，不需额外权限；fs/opener/dialog/shell 类 plugin 权限按需。

### B3 — 自动备份保留策略与旧备份清理（先做，无依赖）

**目标**：当前每 30s 自动保存都会 `backupFile()` 复制 `<path>.backup-<ISO时间戳>`，**无上限、无清理**；补上"只保留最近 N 份"。

**Rust 新增 command**（`commands.rs` + `lib.rs` 注册）：
- `list_backup_files(path) -> Vec<String>`：返回同目录下匹配 `basename.backup-*` 的完整路径，按时间戳降序。
- `delete_files(paths: Vec<String>) -> ()`：逐个删除，失败汇总为 `AppResult<()>`。

**前端**：
- `core/file.ts` 新增 `pruneBackups(path, keep)`：list → 数量 > keep 时删除最旧超出部分。
- `stores/config.ts` 新增 `backupKeepMax`（默认 20，MIN 1 / MAX 100，仿 `recentMaxNum` 校验模式），persist 于现有 config。
- `stores/mindmap.ts::save({backup:true})` 成功后调用 `pruneBackups`；启动时对已知 documentPath 可顺手 prune 一次（可选）。
- `SettingsView.vue` 新增 number input（1-100，step 1）+ 提示文案。

**i18n**：4 语言新键 `settings.backupKeepMax` / `settings.backupKeepMaxHint`。

**测试**：
- `config.spec.ts` 扩 `backupKeepMax` 校验
- 新增 `backup.spec.ts`（纯函数：构造/解析 stamp、排序、超过 keep 时裁剪）
- Rust `cargo check/test` 维持绿

**红线**：只匹配 `.backup-*` 命名（防误删同名用户文件）；删除失败 toast 不静默。
**验证**：两端 `pnpm verify`；`cargo check` / `cargo test`。

---

### B2 — 原生菜单 Recent Files 子菜单真正可用

**目标**：现在 File > "Open Recent" 点击只是跳转 `/editor`；改为动态列出 recentFiles 子菜单，点击即 `openRecent(path)`。

**修改**：
- `core/menu-spec.ts` 扩展 MenuSpecJson，为 File 子菜单支持"Recent Files"展开结构（`open-recent` 项 + 动态 `recent:<path>` 项 + 分隔线 + "清空"项），由前端在**菜单重建时**把 `config.userConfig.recentFiles` 注入 spec。
- 前端 watch `config.userConfig.recentFiles` + locale，变更即触发 rebuild（B1 通道复用，节流 300ms）。
- `App.vue::handleMenuEvent` 增加 `recent:*` 前缀分支 → `store.openRecent(path)`；"清空最近"分支 → `config.clearRecentFiles()`。失败 toast 沿用 Toolbar 现有语义；陈旧路径由 `openRecent()` catch 内 `removeRecentFile` 自动兜底。
- Web 端无原生菜单：不加此功能，仅确认 i18n 键同步存在不报缺键。

**测试**：
- `menu-spec.spec.ts` 覆盖空列表（无 recent 子项）、满列表（含清空项）两种形态。
- `mindmap-store.spec.ts` 复用已有 openRecent 用例。

**红线**：路径过长显示用 basename + title=完整路径；不得把陈旧路径留在菜单。
**验证**：两端 `pnpm verify`；`cargo check`；GUI 手动验证打开/删除。

---

### B4 — 设置页 defSavePath 生效 + 日志落盘开关启用

**目标**：设置页 `defSavePath` 与 `ifSaveLogToDisk` 目前 disabled/"coming soon"；变为真正生效的桌面能力（Web 端保持说明文案，不强做）。

**修改**：
1. `defSavePath`（Tauri）：设置页改按钮"选择默认保存文件夹"（dialog 插件 `open({directory:true})`），保存到 config；`store.saveAs()`/`core/file.ts` 保存对话框 `defaultPath` 优先 `defSavePath + suggestedName`（无则维持现状）。同时给"清除默认路径"按钮。
   - 涉及 `core/tauri-file.ts` 增加可选 defaultPath 透传（或在调用处拼路径），保持 `core/file.ts` 签名 Promise 化不变。
2. `ifSaveLogToDisk`（Tauri）：
   - `core/logger.ts` 增加"落盘"分支：开启时把 warn/error 追加写入 `userData/logs/naotu.log`（经现有 `get_user_data_dir` + 新增 Rust `append_text_file` command，或复用 write_text_file 读取合并——推荐加轻量 append command 避免竞态）。Web 端开关保持禁用。
   - 设置切换即时生效；写失败 toast 不静默。本期不做轮转。
3. i18n：4 语言补 `settings.chooseFolder`/`settings.clearFolder`/`settings.logsHint` 等新键，复用已有 `settings.savePath`/`settings.saveLogs`。
4. 测试：config 校验 defSavePath 为 string；`logger` 相关纯逻辑（是否开启落盘、路径构造）配单测；Rust `cargo check`。

**红线**：Web 端不伪造路径能力（保持 disabled + comingSoon）；日志不得含 API key；追加写必须 Rust command + AppResult。
**验证**：两端 `pnpm verify`；`cargo check`；GUI 手动。

---

## 4. 第三批设计 gate（C1 / C2）

### C1 — MCP 桌面实时桥接（先设计文档 gate）

**Gate 1 必须先产出**：`docs/mcp-live-design.md`
1. 拓扑：推荐"桌面内嵌 loopback HTTP/WS listener"（Tauri 主进程起 tokio listener，绑 `127.0.0.1:随机端口`，启动生成 token 经 stdout 或 userData 公布）；与"外部 server + 状态文件/事件桥"做取舍对比。
2. 鉴权：HTTP 必带 `Authorization: Bearer <token>`，无/错返回 401/403；token 每次启动重新生成；防 CSRF/本机扫描边界说明。
3. 写操作链路（红线：必须经 store actions/命令栈）：Rust 收到 `tools/call` → emit 到目标窗口 → webview 现有 `handleMcpRpcRequest` 执行 → 结果经 `mcp_rpc_response` 事件回 Rust → 应答客户端；明确**多窗口时目标选择规则**（focused？label？单一文档模型？）；给出"与当前文档不一致"的错误码。
4. 读操作：`resources/read` 改为请求时实时生成（复用 `createMcpContext(doc)`），不再用启动快照。
5. 兼容性：stdio `desktop-naotu-mcp`、HTTP `desktop-naotu-mcp-http`、Tauri IPC `mcp_rpc_request` 三条入口的取舍与共存方案；`Cargo.toml` 多 binary + `default-run` 不受影响。
6. 客户端示例：Claude Desktop / Cursor / Cline 的 mcp 配置示例放 `docs/mcp-clients.md`。

**Gate 2 实现**：按文档实施。

**红线**：写操作只能经 store actions（命令栈入栈）；WebView 无 Node API；token 不入日志；body 上限 1 MiB 维持。

---

### C2 — API key 迁移到 OS 凭据管理器（先设计决策）

**Gate**：写 `docs/api-key-storage-design.md`
1. 选型：Rust `keyring` crate（Win Credential Manager / macOS Keychain / Linux Secret Service）vs Tauri `stronghold`（vault 场景偏重）；列出 Windows 下依赖与 CI 影响后选定一种并写理由。
2. Rust 新增 `set_secret/get_secret/delete_secret`（async + AppResult，key 命名如 `desktop-naotu/ai-api-key`）；`config.ts` 的 `aiApiKey` 不再持久化进 config JSON（桌面端从 keyring 读入内存、写时即写 keyring）；Web 端 `isTauri()` 分支照旧 localStorage。
3. 设置页：密码框行为不变（内存态），保存时桌面写 keyring；"测试连接"复用现有 AI 通道。
4. 安全边界：key 不落日志、不落 config 文件、不出现在 MCP context；keyring 不可用时降级 toast 提示而不是崩溃。
5. 测试：Rust 单测 mock 或冒烟（真实 keyring CI 不可用——写明降级策略）；前端 config spec 更新。

**红线**：AI endpoint/model 仍存 config 无妨，仅 key 迁移；不得把 keyring 值写回 JSON。

---

## 5. 执行约定（执行 AI 必读）

1. **顺序**：按"推荐执行顺序"逐项完成；每完成一项立即收尾，**不要攒批**。
2. **收尾模板**（追加到 HANDOFF.md，仿既有 S1/S2 完成记录格式）：
   - 目标与设计一句话；修改文件清单；验证结果（两端 test 数）；仍需人工确认的点；
     本项状态：完成/部分（写明剩余）。
3. **两端同步**：涉及共享前端文件的改动必须 Web/Tauri 同步并分别 `pnpm verify`；
   `pnpm parity` 必过；发现本文件未列出的意外漂移立即分类处理并登记。
4. **质量门禁**：任何提交前两端 `pnpm verify` 全绿（含 `pnpm parity`）；Rust 改动加
   `cargo fmt -- --check`、`cargo check`、`cargo test`、`cargo clippy --all-targets -- -D warnings`。
5. **红线**：遵守两端 AGENTS.md（分层、命令栈、markmap 收口、i18n 四语言、
   禁 alert/confirm、禁 Node API in webview、command 三件套、错误不静默）。
6. **不要做**：不删除 `legacy/`；不在 legacy 开发；不擅自杀用户运行中的实例；
   不重新打包 installer（除非用户明确要求）；不把"需人工 GUI 确认"标成已完成。
7. **改动 >200 行或跨模块**：先在执行会话给出方案说明影响范围（AGENTS 协作规范）。
8. **发现文档/计划与代码冲突**：以代码实际行为为准修正本文档并在 HANDOFF.md 记录，
   不要臆测。

---

## 6. 规划方维护日志

| 日期 | 变更 | 触发 |
|---|---|---|
| 2026-09-06 13:53 | 初版（A1-C3 完整规格）| 接续 commit `e020a75` |
| 2026-09-06 19:40 | **重大更新**：A1-A3+B1 标完成；并入代码审核 `d82535f` 全部遗留项为新"第一批"；B2-B4 + C1-C3 顺位后移；C3 与 P0-1 加耦合说明 | AI 开发者交付 commit `4b68c22`（A1-A3+B1）+ 审核提交 `d82535f` |
