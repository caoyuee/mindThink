# 代码审核结论 — d49f2e5..HEAD（2026-09-06 交付批次）

> 审核人：代码审核师（只读审核，未改动任何文件）
> 审核依据：`HANDOFF.md` 架构红线、`mindmap-vue3/AGENTS.md`、`tauri-spike/AGENTS.md`、`tauri-spike/CONVENTIONS.md`、`tauri-spike/ARCHITECTURE.md`
> 审核范围：09-06 提交链 `d49f2e5..HEAD`（右键菜单/Properties 布局、快捷键说明页 + registry、.km 原生导出、快捷键真正可用化 `e020a75`），45 文件、约 2193 行新增
> 请 AI 开发者按 **P0 → P1 → P2** 顺序修复，每项完成后在文件末尾登记。

## 0. 现状门禁（审核时实测，供基线对照）

按 HANDOFF §8 记载，Vitest 在 DSH 沙箱内会 spawn EPERM，需 danger-full-access 运行；以下均为实测结果：

| 项目 | typecheck | lint | format:check | test |
|---|---|---|---|---|
| mindmap-vue3（Web） | ✅ | ✅ | ✅ | 45 passed（8 files） |
| tauri-spike | ✅ | ✅ | ✅ | 55 passed（8 files） |

与 HANDOFF 声称一致。测试全绿**不代表**快捷键正确——P0 缺陷不在现有测试覆盖内（见 §1.2）。

---

## 1. P0 — 快捷键修饰键匹配错误（必须改，两端同源同 bug）

### 1.1 现象（已用匹配逻辑同构模拟确认）

文件：`mindmap-vue3/src/composables/useShortcuts.ts` 与 `tauri-spike/src/composables/useShortcuts.ts`

| 用户按键 | 期望动作 | 实际触发 | 结果 |
|---|---|---|---|
| `Ctrl/Cmd+Enter` | placeRoot（根节点居中 fit） | addSibling（新增兄弟） | Mod+Enter 失效 |
| `Alt+↑` / `Alt+↓` | reorder（重排节点） | navigate（移动选区） | Alt+方向键失效 |
| `Shift+Tab` | outdent（左缩进） | indent（右缩进） | Shift+Tab 行为反了 |
| `Ctrl/Cmd+Shift+Z` | redo | undo | Shift+Z 重做失效（Mod+Y 仍可用） |

### 1.2 根因

`matchModifier(e, mod)`（约 58–65 行）只校验"需要的修饰键是否按下"，**不排除多余按下的修饰键**：

```ts
function matchModifier(e: KeyboardEvent, mod: number): boolean {
  const meta = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
  if (mod & 1 && !e.ctrlKey && !(mod & 8)) return false;
  if (mod & 8 && !meta) return false;
  if (mod & 2 && !e.altKey) return false;
  if (mod & 4 && !e.shiftKey) return false;
  return true; // ← 无修饰键条目（mod=0）恒真，且不排除已按下的多余修饰键
}
```

同时 `onKeyDown`（约 79–89 行）命中首个匹配即 `return`；`bindById`（约 101–110 行）按 `SHORTCUT_REGISTRY` 顺序插入 handler Map，无修饰键项（`Enter`/`Tab`/`↑`/`Mod+Z`）先注册，于是把带修饰键的组合全部先吞掉。

### 1.3 修复要求

1. 把匹配改为**修饰键精确相等**（需求位与事件位逐一相等；`Mod` 在 mac=meta、win/linux=ctrl），保证：
   - 按 `Alt+↑` 只命中 reorder，不命中 navigate；
   - 按 `Ctrl/Cmd+Enter` 只命中 placeRoot，不命中 addSibling；
   - 按 `Shift+Tab` 只命中 outdent，不命中 indent；
   - 按 `Ctrl/Cmd+Shift+Z` 只命中 redo，不命中 undo。
2. 把 `parseShortcut` / 匹配函数抽成**可单测的纯函数并导出**（`core/` 或 composable 内导出均可，CONVENTIONS 要求纯逻辑可测）。
3. 新增键盘级 spec（建议 `src/tests/shortcuts.spec.ts` 扩充，或新建 `useShortcuts` 单测），至少覆盖上表 4 个组合 + 正例（纯 `Enter`→addSibling、纯 `Tab`→indent、纯 `↑`→navigate、`Ctrl+Z`→undo、`Ctrl+Y`→redo）。现有测试只覆盖 ShortcutsView 渲染与 registry 行数，无法发现本缺陷。
4. Web/Tauri 两端同步修改，分别 `pnpm verify`。

### 1.4 验收

- 上面 4 个组合 + 正例的测试通过；
- 在 GUI 中实际按键验证：Alt+↑/↓ 移动节点而非选区、Shift+Tab 左缩进、Mod+Enter 根节点居中、Ctrl+Shift+Z 重做。

---

## 2. P1 — 两端 / 四语言同步问题

### 2.1 `shortcut.outdent` 在全部 8 个 locale 缺失

- registry：`src/core/shortcuts.ts` 中 `outdent` entry 的 `descKey: 'shortcut.outdent'`；
- 检查 `mindmap-vue3` + `tauri-spike` 各 4 个 `src/i18n/locales/*.json`：`shortcut` 分组均无 `outdent` 键，且兜底语言 zh-CN 也没有 → 快捷键页该行会**显示原始 key 文本 "shortcut.outdent"**。
- 同时 `indent` entry 误用 `descKey: 'shortcut.insertChild'`（"插入子节点"），与实际动作"向右缩进"语义不符。
- 修复：新增 `shortcut.indent`（如"向右缩进"）与 `shortcut.outdent`（如"向左缩进"）并**四语言 × 两端共 8 个文件**补齐。

### 2.2 `tauri-spike` en 缺 `node.defaultName`

- `tauri-spike/src/i18n/locales/en.json` 的 `node` 分组无 `defaultName`（zh-CN/zh-TW/de 及 Web 端 en 均有）。
- 影响：英文桌面端按 Enter/F2/添加子节点时，新节点回退显示中文"新节点"（fallback zh-CN）。
- 修复：补 `node.defaultName: "New node"`（对齐 `mindmap-vue3` en 的文案）。

### 2.3 `command.*` 命名键两端不齐

Web 缺：`updateNote`、`reorderNode`、`addParent`、`pasteNode`；
Tauri 缺：`reorderNode`、`addParent`、`pasteNode`。
现有旧键（renameNode/addChild/addSibling/removeNode/setRootText/indentNode/outdentNode + Tauri 的 updateNote）齐全。

- 影响：`lastUndoName`/`lastRedoName` 目前无 UI 消费方，暂不可见；但违反 AGENTS "命令名必须用 i18n key / 四语言同步"，一旦 Toolbar 展示上次操作名即露馅。
- 修复：按两端各自已用键补齐文案（zh-CN 基线必须含，其余语言可复用现有风格翻译）。

### 2.4 `src/core/km.ts` 两端未完全同步

- Web 端文件头仍是 `/** KityMinder .km JSON importer. */`（本批只改了 Tauri 端为"导入/导出器"）；
- Web 端导入器缺少 Tauri 端已有的"根节点为空/纯默认文本时拒绝"校验与对应负向测试；
- 修复：把 Web `km.ts` 导入器合并为与 Tauri `km.ts` 一致（`textOf`/`childrenOf`/`convertNode` + 空根校验），并把该负向用例同步到两端 `tests/km.spec.ts`。

---

## 3. P2 — 健壮性与一致性问题

1. **快捷键层无键盘级测试**（详见 §1.3，P0 修复时一并补）。
2. **无修饰键条目在任意多余修饰键下都会触发**：同 `matchModifier` 缺陷的衍生表现（例如 `Ctrl+Shift+C` 会被 copyNode 拦截），随 P0 精确匹配修复一并解决。
3. **Delete 根节点产生空撤销命令**：`stores/mindmap.ts` 的 `removeNode` 在 `applyEdit` 回调内才拦截根节点（`return d`），键盘 Delete 选中根节点时仍 push 一条空命令、`canUndo` 变 true。与本批其他新 action（`reorderNode`/`addParent`/`cutNode` 均前置守卫、无效操作不入栈）原则不一致。
   - 修复：`removeNode` 同样在 `applyEdit` 之前对"根节点 / 找不到节点"做前置 return（Web/Tauri 两端）。
4. **快捷键页"视野控制"分组几乎被清空**：registry 化后 `scope` 分组只剩 `dblClickSpace`（todo）一项，原说明页的拖动/滚轮/触摸板/缩放说明消失（locale 中 `shortcut.drag*`/`zoomScope` 等成为死键）。若属有意收窄请忽略；否则建议为这些非键盘手势在 registry 中留占位行，避免帮助信息倒退。
5. **死代码**：`stores/mindmap.ts` 的 `store.handleKey()`（Tab/Delete/Ctrl+Z/Y 分支）改造后已无调用方，与 `useShortcuts` 双路径重复，建议删除（确认无引用后，两端同步）。
6. **次要**：`cut` 后无选中直接 `Ctrl+V` 会静默失败（`pasteNode` 返回 false 无提示）——属可接受的交互设计，dialogs 化时再补反馈即可，不阻塞。

---

## 4. 修复顺序与交付要求

1. 按 P0 → P1 → P2 完成，先 P0（功能错误）后 i18n/同步（可见性问题）再健壮性。
2. 每完成一项：两端分别 `pnpm verify`（typecheck + lint + format:check + test 全绿），并补相应单测。
3. 本批次涉及快捷键，**必须 GUI 实机验证**：Alt+↑/↓、Shift+Tab、Mod+Enter、Ctrl+Shift+Z 四组按键（§1.4），以及英文界面新增节点文案（§2.2）。
4. 修复完成后把结果回写 `HANDOFF.md`（§4/§10 追加记录：修改文件、验证结果），并删除本文件或标记"已修复"（由用户决定）。

## 5. 修复登记表

| 编号 | 严重度 | 描述 | 修复状态 | 验证 | 修改文件 |
|---|---|---|---|---|---|
| P0-1 | P0 | useShortcuts 修饰键精确匹配 + 4 组按键冲突 | ☐ | ☐ | 两端 `composables/useShortcuts.ts` + `tests/` |
| P1-1 | P1 | `shortcut.outdent`/`shortcut.indent` 缺失或误用（8 locale） | ☐ | ☐ | 两端 `i18n/locales/*.json` |
| P1-2 | P1 | tauri-spike en 缺 `node.defaultName` | ☐ | ☐ | `tauri-spike/src/i18n/locales/en.json` |
| P1-3 | P1 | `command.*`（reorderNode/addParent/pasteNode/updateNote）两端补齐 | ☐ | ☐ | 两端 `i18n/locales/*.json` |
| P1-4 | P1 | Web `core/km.ts` 与 Tauri 同步（头注释 + 空根校验 + 负向测试） | ☐ | ☐ | `mindmap-vue3/src/core/km.ts`、两端 `tests/km.spec.ts` |
| P2-1 | P2 | `removeNode` 前置守卫（根/不存在不入栈） | ☐ | ☐ | 两端 `stores/mindmap.ts` |
| P2-2 | P2 | 删除死代码 `store.handleKey` | ☐ | ☐ | 两端 `stores/mindmap.ts`（先确认无引用） |
| P2-3 | P2 | ShortcutsView scope 分组占位（可选） | ☐ | ☐ | 两端 `core/shortcuts.ts` |

> 注：P1-3 中 Web 端 `command.updateNote` 缺失为历史漂移，本批未引入，但属"当前代码不符合规范"项，建议顺手补齐。

---

## Round 2 审核记录（NEXT-PLAN 执行批 `4b68c22`，2026-09-06）

> 由另一 AI 按 `NEXT-PLAN.md` 规划执行 A1–A3 + B1；本文档作者以代码审核师身份复审该提交并更新本文件。

### R2.0 范围与门禁实测

- 范围：commit `4b68c22`（A1 parity / A2 dialogs / A3 代码分割 / B1 菜单本地化），HANDOFF.md + NEXT-PLAN.md 同步归档。
- 门禁（独立于开发者自报）：
  - Web `pnpm verify`：parity `34 shared / 0 mismatch` → typecheck/lint/format → **56 tests** 全绿
  - Tauri `pnpm verify`：同 parity → **68 tests** 全绿
  - Rust `cargo fmt --check` / `cargo check` / `cargo test`（7 passed）/ `cargo clippy -D warnings` 全绿
  - 两端 `pnpm build`：均无 >500 KiB 告警，最大 chunk 325 / 329 kB；Tauri `base './'` 未改
- 结论：四道门禁全过，**可合并**（已在审核后合入 `main`）。

### R2.1 红线与规范核查（实测）

| 红线 / 规范 | 核查 | 结果 |
|---|---|---|
| 禁止 `window.(prompt|confirm|alert)(` | 全代码 grep 实证 | ✅ 0 命中（A2 目标达成） |
| AGENTS #7（dialog 替代） | Components dialogs + useDialog + DialogHost 三件套 | ✅ |
| 对话框文案 i18n | 所有调用点传 `t('common.ok/cancel/confirm')`、`node.rename/deleteConfirm` | ✅ |
| 退出拦截时序保留 | `confirmDiscard` 在 `new` / `open` / `onCloseRequested` / `openRecent` 均被 `await`，`event.preventDefault()` 不变 | ✅ |
| Rust 命令 `async` + `AppResult` | `rebuild_native_menu` 异步、无 unwrap/expect、未知 role 拒绝并有单测 | ✅ |
| Rust 三件套（commands.rs / lib.rs / capabilities） | `commands.rs` 定义 + `lib.rs::generate_handler!` 注册；自定义 command 无需 capability 暴露 | ✅ |
| `core/` 不依赖 Vue/Tauri | `menu-spec.ts` 注入 `(key)=>label`，`km.ts` 纯函数 | ✅ |
| markmap 收口 | 无新增 Markmap 调用 | ✅ |
| 跨模块改动需说明 | 已写入 NEXT-PLAN.md 与 HANDOFF.md 完成记录 | ✅ |
| Web/Tauri 同步 | `parity` 脚本接入两端 `verify`；34 个共享文件逐字节一致；7 个合理差异已记录原因 | ✅ |
| i18n 四语言 | 8 locale JSON 含 `common.*`、`dialog.*`（web 4 个）、`menu.*`（tauri 4 个）、`node.*` | ⚠️ 仅 `tauri-spike/en node.defaultName` 仍缺（§2.2 遗留） |
| 构建告警 | 两端 `pnpm build` 无 >500 KiB 告警 | ✅ |

### R2.2 本批新增的关注项（低风险，非阻塞）

1. `ConfirmDialog` / `PromptDialog` 默认 `okText='OK'` / `cancelText='Cancel'` 为英文兜底；当前所有调用点都传了本地化文本，但建议未来把默认值改为必传或在组件内走 i18n，避免遗漏时显示英文。
2. `useDialog` 单弹窗模型：并发 confirm 会让先开的 Promise 永不 settle（代码注释已声明接受）。低，可考虑队列化。
3. `parity` 脚本对"只存在于单端的新文件"只 info 提示不失败（存在合法 Tauri-only 文件）。新共享文件漏建一端不会拦 verify；如需更严可在脚本加显式 allowlist。
4. `core/file.ts`（Web）`exportSvg/exportPng/exportKm` 第三个 `title` 参数以 `eslint-disable` 注释忽略，与 Tauri 签名对齐但不消费——保持一致可接受，未来若 Web 改用 FS Access 提示可去掉。

### R2.3 本批未触及、仍开放的旧项

下一修复轮需处理（仍未分配批次）：

- **P0-1** `useShortcuts` 修饰键匹配缺陷（4 组按键冲突）
- **P1-1** `shortcut.outdent` / `shortcut.indent` 8 个 locale 缺失或误用
- **P1-2** `tauri-spike/en` 缺 `node.defaultName`
- **P1-3** `command.*`（reorderNode/addParent/pasteNode/updateNote）两端补齐
- **P2-1** `removeNode` 根/不存在节点前置守卫
- **P2-2** 死代码 `store.handleKey`
- **P2-3** ShortcutsView scope 分组占位（可选）

### R2.4 本批已修复（关闭旧登记项）

| 编号 | 修复方式 | 验证 |
|---|---|---|
| P1-4 | Web `core/km.ts` 收敛到 Tauri 规范版（`textOf` / `childrenOf` / `convertNode(value, isRoot)` + 空根校验）；文件头注释同步为"导入/导出器"；负向用例随 parity 一并覆盖 | `pnpm verify` 两端绿；parity `0 mismatch`（km.ts 共享且一致） |

### R2.5 本批待人工 GUI 确认（与本审核无关，HANDOFF 已记录）

- 原生菜单切语言即时本地化（debug 模式打开设置切换语言）
- 项目 dialogs 在右键重命名 / 删除 / 退出拦截弹窗的呈现与 Esc/Enter 行为
- Tauri `base './'` 下懒加载路由刷新不白屏
- Tauri 重打包（`pnpm build:tauri`）后安装包验证新图标与对话框文案

---

## 5. 修复登记表（Round 2 更新）

| 编号 | 严重度 | 描述 | 修复状态 | 验证 | 修改文件 |
|---|---|---|---|---|---|
| P0-1 | P0 | useShortcuts 修饰键精确匹配 + 4 组按键冲突 | ☐ | ☐ | 两端 `composables/useShortcuts.ts` + `tests/` |
| P1-1 | P1 | `shortcut.outdent`/`shortcut.indent` 缺失或误用（8 locale） | ☐ | ☐ | 两端 `i18n/locales/*.json` |
| P1-2 | P1 | tauri-spike en 缺 `node.defaultName` | ☐ | ☐ | `tauri-spike/src/i18n/locales/en.json` |
| P1-3 | P1 | `command.*`（reorderNode/addParent/pasteNode/updateNote）两端补齐 | ☐ | ☐ | 两端 `i18n/locales/*.json` |
| P1-4 | P1 | Web `core/km.ts` 与 Tauri 同步（头注释 + 空根校验 + 负向测试） | ✅（Round 2 / `4b68c22`） | ✅ 两端 verify + parity 0 | `mindmap-vue3/src/core/km.ts`（收敛至 Tauri 规范版） |
| P2-1 | P2 | `removeNode` 前置守卫（根/不存在不入栈） | ☐ | ☐ | 两端 `stores/mindmap.ts` |
| P2-2 | P2 | 删除死代码 `store.handleKey` | ☐ | ☐ | 两端 `stores/mindmap.ts`（先确认无引用） |
| P2-3 | P2 | ShortcutsView scope 分组占位（可选） | ☐ | ☐ | 两端 `core/shortcuts.ts` |
