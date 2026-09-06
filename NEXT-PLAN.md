# NEXT-PLAN.md — 下一批功能实施计划（交给执行 AI）

> 本文件是**规划产物**，由规划方（2026-09-06，接续 commit `e020a75`）产出。
> 执行方（另一 AI）按本文档逐项实施，**不得跳项、不得扩项**；每完成一项按
> "执行约定（末尾）"更新 HANDOFF.md 并做验证。
>
> 基线（已由规划方复测）：Web `pnpm verify` 45 tests 通过；Tauri `pnpm verify`
> 55 tests 通过。任何提交前必须保持两端全绿（允许测试数只增不减）。

---

## 0. 总览与推荐执行顺序

| 批次 | 任务 | 名称 | 规模 | 跨 Rust? | 依赖 |
|---|---|---|---|---|---|
| A 工程收口 | A1 | 两端源码一致性审计 + 防漂移护栏 | 中 | 否 | 无（**最先做**） |
| A 工程收口 | A2 | 用项目 dialogs 替换 `window.prompt/confirm` | 中 | 否 | A1（收敛后再改组件，避免双份返工） |
| A 工程收口 | A3 | Vite 代码分割，消除 >500 KiB chunk 告警 | 小-中 | 否 | 无（可与 A1 并行） |
| B 桌面打磨 | B1 | 原生菜单四语言本地化（动态重建） | 中-大 | 是 | A2（B1 后置时菜单事件仍走现有通道，无硬依赖） |
| B 桌面打磨 | B2 | 原生菜单 Recent Files 子菜单真正可用 | 中 | 是 | B1（复用其菜单 spec 通道） |
| B 桌面打磨 | B3 | 自动备份保留策略与旧备份清理 | 中 | 是 | 无 |
| B 桌面打磨 | B4 | 设置页 defSavePath 生效 + 日志落盘开关启用 | 中 | 是（部分） | 无 |
| C 能力增强 | C1 | MCP 桌面实时桥接 + HTTP 鉴权 + 客户端示例 | 大 | 是 | **先出设计文档**（gate） |
| C 能力增强 | C2 | API key 迁移到 OS 凭据管理器 | 中-大 | 是 | 先出设计决策 |
| C 能力增强 | C3 | 剩余 todo 快捷键裁决（多数应显式推迟） | 小 | 否 | 无 |

推荐执行顺序：**A1 → A2 → A3 → B3 → B1 → B2 → B4 → C3 → C1 → C2**。
理由：A 批风险最低、纯前端、不与人工回归互相阻塞，先做可快速建立干净的收敛基线；
B 批按"无依赖→有依赖"排（B3 独立先做）；C3 是廉价裁决放 C 批开头；
C1/C2 涉及架构决策，**必须各出一份设计文档经确认后再写代码**。

> ⚠️ 人工门槛（**执行 AI 不做、只提醒用户**）：P0 GUI 实机回归、重新生成安装包
> （`pnpm build:tauri`）、P1 全桌面验收。执行 AI 不得擅自终止用户正在运行的
> release/debug 实例，也不要把旧的 MSI/NSIS 当作"新产物"。

---

## A 批：工程收口

### A1 — 两端源码一致性审计 + 防漂移护栏

**目标**：Web（`mindmap-vue3/src`）与 Tauri（`tauri-spike/src`）手工同步的共享源码
出现意外漂移；为每次"同步改动"提供分类结论，并建立防漂移护栏，防止后续功能继续双份返工。

**现状（已核实）**：共享目录内 11 个非 locale 文件哈希不一致：

```
components\editor\MindEditor.vue        components\layout\AppStatusBar.vue
components\panels\OutlineTree.vue       components\panels\Properties.vue
components\panels\Toolbar.vue           core\ai.ts
core\file.ts                            core\km.ts
core\mcp.ts                             stores\config.ts
stores\mindmap.ts
```

另有 i18n 结构差：Tauri zh-CN 有 16 个顶层分组、Web 15 个（Tauri 多 `app.tauriStartupFailed` 等
Tauri-only 键属**合理差异**）。

**注意**：`file.ts` 两端**按设计不同**（Web 是 FS Access 实现，Tauri 是平台路由壳），
`core/*-file.ts`、`platform.ts`、`document-title.ts` 本来就是 Tauri-only —— 这些**不是事故漂移**。

**规格**：
1. 对上述 11 个文件逐一做 `git diff --no-index mindmap-vue3/<f> tauri-spike/<f>`
   （注意换行告警可忽略），把差异分类：
   - **事故漂移**（一个方向先改、另一方向漏同步）：修复 = 以"功能新、实现正确"的一方为基准，
     把另一方收敛到一致。
   - **合理差异**（Tauri-only 分支、平台守卫、title 参数、图标等）：在文档中记录原因，
     不强行抹平。
2. 收敛后把结果写入本文件 A1 小节（或 HANDOFF.md），逐文件标注"事故已收敛 / 合理差异"。
3. 新增**防漂移脚本**（推荐放 `scripts/check-frontend-parity.mjs`，或复用两端任意一端）：
   - 定义"必须一致"清单（所有共享组件/composables/core(除 tauri-only)/stores/views/router/types，
     即 A1 收敛后两端应逐字节一致的集合），排除 file.ts、web-file.ts、tauri-file.ts、
     platform.ts、document-title.ts、tests/、locales/。
   - 用文件哈希比较两端，不一致时非零退出并列出差异清单。
   - 在**两端** `package.json` 的 `verify` 前加 `parity` 脚本调用它（Windows 兼容路径，
     相对 `../` 跨目录引用时用 `path.resolve`/fileURL）。若因目录隔离无法优雅跨目录，
     至少提供手动命令并在 AGENTS.md 记录"同步改动后必须跑 parity"。
4. 若 A1 收敛过程发现某事故漂移曾破坏行为（如 `stores/mindmap.ts` 或 `config.ts` 语义差），
   以两端各自 tests 为准修回归，并补充缺失测试。

**红线**：不动架构分层；不把合理差异当 bug；不引入新依赖（脚本用 node 内置即可）。
**验证**：两端 `pnpm verify` 通过；新增 parity 脚本对收敛后的树返回 0；
故意改坏一个共享文件时脚本能非零失败（可在本地试一次后还原）。
**涉及文件**：按第 1 步实际 diff 结果；`scripts/check-frontend-parity.mjs`（新）；
两端 `package.json`；本文件/HANDOFF.md。

---

### A2 — 用项目 dialogs 替换 `window.prompt/confirm`

**目标**：兑现 AGENTS.md 红线 #7（"spike 阶段暂用 window.prompt/confirm，将在 dialogs/
目录下替换"）。`components/dialogs/` 目录已存在但为空（两端），现把全部原生弹窗换成
自研 Promise 式对话框。

**现状（已核实）调用点**：

| 位置 | 用途 | 现状 |
|---|---|---|
| `tauri-spike/src/App.vue` L150 | 退出/新建/打开前"放弃修改"确认 | `window.confirm` |
| 两端 `components/panels/Properties.vue` | 删除选中节点确认 | `window.confirm` |
| 两端 `components/editor/MindEditor.vue` | 右键菜单"重命名" | `window.prompt` |
| 两端 `components/editor/MindEditor.vue` | 右键菜单"删除"确认 | `window.confirm` |

**规格**：
1. **新建 `components/dialogs/` 基础组件**（两端各一份）：
   - `ConfirmDialog.vue`：标题/正文/确认/取消，`role="dialog"` + `aria-modal`，
     Esc=取消、Enter=确认、自动聚焦安全按钮、Teleport 到 body、焦点圈闭（简单实现即可）。
   - `PromptDialog.vue`：在 Confirm 基础上加单行输入框（重命名用），初始值全选、Enter 提交、Esc 取消。
   - 可选 `components/dialogs/DialogHost.vue` + Pinia/composable `useDialog()`：
     提供 Promise 式 `confirm(opts): Promise<boolean>`、`prompt(opts): Promise<string|null>`，
     单例挂载于 App 根；避免每个调用点各写一套 v-if 状态。
2. **替换全部调用点**：
   - `App.vue` 的 `confirmDiscard()` → `await confirm(...)`（注意 onCloseRequested 是异步拦截，
     保持现有 `event.preventDefault()` 语义）。
   - `Properties.vue` / `MindEditor.vue` 删除确认、重命名 prompt 全部改走 useDialog。
   - 替换后 grep 确认两端 `window.(prompt|confirm|alert)` **清零**（保留注释里提及的不算）。
3. **i18n**：四语言（zh-CN/en/zh-TW/de）同步；新键放 `dialog.*` 与 `common.ok/cancel`；
   已有 `node.rename/node.deleteConfirm/document.discardChanges` 直接复用，不加重复键。
4. **测试**：用已安装的 `@vue/test-utils`（shortcuts.spec 已有先例）给 Confirm/Prompt
   或 `useDialog` 补组件测试（至少：确认返回 true/false、取消返回 false/null、Esc 触发取消、
   Prompt 提交返回输入值）。`core/` 无新增纯函数则不强求 spec，但组件测试必须两端各一套。

**红线**：禁止 `alert/confirm/prompt`；对话框文案必须走 i18n；不得破坏退出拦截时序。
**验证**：两端 `pnpm verify` 通过；grep `window.(prompt|confirm|alert)` 两端为 0；
A1 的 parity 脚本（若含组件）通过。
**涉及文件**：两端 `components/dialogs/*`（新建）、`App.vue`、`Properties.vue`、
`MindEditor.vue`、`composables/useDialog.ts`（新建）、4 个 locale 文件 ×2、tests。

---

### A3 — Vite 代码分割（消除 >500 KiB chunk 告警）

**目标**：主 bundle 约 800 KiB，构建有 chunk >500 KiB 告警；通过 manualChunks + 路由懒加载
把 vendor 拆开，消除告警并改善首屏。

**现状（已核实）**：两端 vite.config 均为最简（无 `build.rollupOptions.output.manualChunks`）；
路由 `router/index.ts` 直接静态 import 全部 views。

**规格**：
1. 两端 `vite.config.ts` 增加 `build.rollupOptions.output.manualChunks`，建议分桶：
   - `vue-vendor`：vue、vue-router、pinia、vue-i18n
   - `markmap`：markmap-lib、markmap-view、markmap-toolbar（若引用）
   - 其余（nanoid 等）并入默认。
2. `router/index.ts` 把非编辑器页面（Settings/About/Shortcuts/NotFound）改为动态
   `import()`（配合 `component: () => import(...)`），Editor 页保持静态或按需拆。
   注意：懒加载后路由级 Vue 仍按现有 CSS 变量主题渲染，不需要额外配置。
3. 构建后核对：
   - 无 "Some chunks are larger than 500 KiB" 告警（允许个别略大 vendor 桶提示，若还有则再分）。
   - 应用能正常路由跳转、刷新不白屏（Tauri base './' 下懒加载 chunk 路径必须正确——
     这是重点回归点）。
4. 两端分别 `pnpm build` 通过；若 Tauri 端改完需用户后续重打包才生效，在 HANDOFF.md 标注。

**红线**：不改 `base`/`publicPath` 以外的资源路径语义；不删 `vue-tsc -b` 步骤。
**验证**：两端 `pnpm verify` + `pnpm build`；无 500 KiB 告警；产物 dist 含分桶 chunk。
**涉及文件**：两端 `vite.config.ts`、`src/router/index.ts`。

---

## B 批：桌面原生打磨（跨 Rust）

> 以下各项若引入新 Tauri command，必须按红线三件套：`commands.rs` 定义 →
> `lib.rs` `generate_handler![]` 注册 → `capabilities/default.json` 加权限（如需要）。
> Rust command 必须 `async` + 返回 `AppResult<T>`，禁止 unwrap/expect 于生产路径。

### B3 — 自动备份保留策略与旧备份清理（先做，无依赖）

**目标**：当前每 30s 自动保存都会 `backupFile()` 复制一份 `<path>.backup-<ISO时间戳>`，
**无上限、无清理**；补上"只保留最近 N 份、自动清理更旧文件"。

**现状（已核实）**：`tauri-spike/src/core/file.ts::backupFile()` 调 `tauriCopyFile(path,
path+'.backup-'+stamp)`；`commands.rs` 只有 `copy_file`，无列表/删除；capabilities 无
remove 权限。`App.vue` 30s timer 只在 `isDirty && documentPath` 时保存并备份。

**规格**：
1. Rust（`commands.rs` + `lib.rs` 注册）新增两个 command（仿 `copy_file` 写法，自定义
   command 不受 fs scope 限制）：
   - `list_backup_files(path)` → 返回同目录下匹配 `basename.backup-*` 的文件名数组
     （含完整路径），按时间戳倒序。
   - `delete_files(paths: Vec<String>)` → 逐个删除并汇总失败（AppResult）。
2. 前端：
   - `core/file.ts` 新增 `pruneBackups(path, keep)`：list → 若数量 > keep 删除最旧超出部分。
   - `stores/config.ts` 新增 `backupKeepMax`（默认 20，MIN 1 / MAX 100，仿
     `recentMaxNum` 的 `normalize` 校验模式），persist 于现有 config。
   - `stores/mindmap.ts::save({backup:true})` 成功后调用 pruneBackups；`loadConfig`
     在桌面启动时可顺手对已知 documentPath prune 一次（可选）。
   - 注意 timestamp 里 `:`/`.` 已被替换为 `-`，文件名排序即可当时间序；实现时写清依赖，
     用纯函数解析/构造 stamp 并配单测。
3. `SettingsView.vue` 新增 number input（范围 1-100，step 1）+ 提示文案；
   四语言新键 `settings.backupKeepMax` / `settings.backupKeepMaxHint`。
4. 测试：config.spec 扩 `backupKeepMax` 校验；新增 `backup.spec.ts`（纯函数：构造/解析
   stamp、排序、超过 keep 时裁剪列表）；Rust 端至少 `cargo check/test` 通过
   （有现成 5 个 test 保持绿）。

**红线**：不删除正在使用的当前文件；只匹配 `.backup-*` 命名；清理失败要 toast 而非静默。
**验证**：两端 `pnpm verify`；`cargo check`、`cargo test`；Tauri `cargo clippy` 可选。
**涉及文件**：`src-tauri/src/commands.rs`、`src-tauri/src/lib.rs`、两端 `core/file.ts`、
`stores/config.ts`、`stores/mindmap.ts`、`views/SettingsView.vue`、4 locale ×2、tests。

---

### B1 — 原生菜单四语言本地化（动态重建）

**目标**：Rust `lib.rs::build_menu()` 目前硬编码英文（"File/Edit/New/Open Recent/Save…"）；
改由前端 locale 驱动重建，使菜单跟随设置页语言即时切换。

**现状（已核实）**：`lib.rs` 用 `MenuBuilder/SubmenuBuilder/MenuItemBuilder` 在 setup 建菜单，
`on_menu_event` 把 `event.id()` emit 成 `menu_event` 给 webview，前端 `App.vue::handleMenuEvent`
按 id 分发。i18n 已有 `menu.*`（tauri 12 键含 file/edit/view/help/openRecent/…）。

**推荐设计（可让执行 AI 在此范围内做实现级取舍）**：
- Rust 新增 command `rebuild_native_menu(spec: MenuSpecJson)`：接收前端按当前语言生成的结构化
  spec（子菜单名、项 label + id + accelerator、预置角色项如 undo/redo/cut/copy/paste/
  select_all/fullscreen/about/quit），在 Rust 侧重建并 `app.set_menu(...)`；
  返回 AppResult。App 启动时前端 mount 后调用一次（覆盖默认英文），语言切换时再调用。
  - 关于项与 quit 等"角色"项：保留 Rust 侧 `AboutMetadataBuilder`/`.quit()` 语义，
    spec 里用布尔/枚举表达，避免 JS 端重建丢失 about 窗口元数据。
- 前端：抽纯函数 `buildNativeMenuSpec(locale): MenuSpecJson`（放 `core/menu-spec.ts`，
  可测）；`App.vue`/`SettingsView` 在 `setLocale` 后 + watch locale 触发 `fileApi.rebuildMenu(spec)`；
  失败 toast（走现有 `toast`），不阻塞 UI。
- 能力评估：`core:menu:*` 若有需要则加进 `capabilities/default.json`；自定义 command
  通常无需额外权限，但仍按红线三件套走一遍检查。
- 测试：`menu-spec.spec.ts` 覆盖四语言 label 齐全、id 稳定、accelerator 完整；
  手动项：Tauri debug 窗口切语言看原生菜单是否即时变化（记录到 HANDOFF 待人工确认）。

**红线**：菜单事件 id 与前端 `handleMenuEvent` 的 case 保持一一对应；不得改动
`default-run = "desktop-naotu"` 与多 binary 打包配置。
**验证**：两端 `pnpm verify`；`cargo check`；若 JS API 走 invoke 需在 debug build 冒烟一次。
**涉及文件**：`src-tauri/src/lib.rs`（菜单 spec 重建）、`commands.rs`（新增）、两端
`core/menu-spec.ts`（新，Tauri 端必需、Web 端可只留纯函数不调用）、`App.vue`、locale、
tests、capabilities（如需）。

### B2 — 原生菜单 Recent Files 子菜单真正可用

**目标**：现在 File > "Open Recent" 点击只是跳转 `/editor`，没打开文件；改为动态列出
recentFiles 子菜单，点击即 `openRecent(path)`（沿用已有失败自动移除逻辑）。

**规格**：
1. 在 B1 的 `MenuSpecJson` 中为 File 子菜单支持"Recent Files"展开结构（`open-recent` 项 +
   动态 `recent:<path>` 项 + 分隔线 + "清空"项），由前端在**菜单重建时**把
   `config.userConfig.recentFiles` 注入 spec。
2. 前端 watch `config.userConfig.recentFiles` + locale，变更即触发 rebuild（B1 通道复用，
   节流避免频繁重建，如 300ms debounce）。
3. `App.vue::handleMenuEvent` 增加 `recent:*` 前缀分支 → `store.openRecent(path)`，
   成功/失败 toast 沿用 Toolbar 现有语义；"清空最近"分支 → `config.clearRecentFiles()`。
   （失败移除逻辑已在 `openRecent()` catch 内，无需重复实现。）
4. Web 端无原生菜单：不加此功能，仅确认 i18n 键同步存在不报缺键。
5. 测试：`menu-spec.spec.ts` 覆盖空列表（无 recent 子项）、满列表（含清空项）两种形态；
   `mindmap-store.spec.ts` 已有 openRecent 相关用例则复用。

**红线**：路径过长显示用 basename + title=完整路径；不得把陈旧路径留在菜单（由现有
removeRecentFile 逻辑兜底）。
**验证**：两端 `pnpm verify`；`cargo check`；GUI 手动：新建两个文件→Open Recent 子菜单→
点击直接打开、删除文件后点击报错并自动移除。
**涉及文件**：B1 的文件 + `core/menu-spec.ts` 扩展、`App.vue`、locale（menu.openRecent 已有，
补 clearRecent 等键）、tests。

### B4 — 设置页 defSavePath 生效 + 日志落盘开关启用

**目标**：设置页 `defSavePath` 与 `ifSaveLogToDisk` 目前 disabled/"coming soon"；
把它们变为真正生效的桌面能力（Web 端保持说明文案，不强做）。

**规格**：
1. `defSavePath`（Tauri）：设置页改为按钮"选择默认保存文件夹"（走现有 dialog 插件
   `open({directory:true})`），保存到 config；`store.saveAs()`/`core/file.ts` 保存对话框
   `defaultPath` 优先 `defSavePath + suggestedName`（无则维持现状）。同时给出"清除默认路径"按钮。
   - 涉及 `core/tauri-file.ts` 增加可选 defaultPath 透传（或直接在调用处拼路径），
     保持 `core/file.ts` 签名 Promise 化不变。
2. `ifSaveLogToDisk`（Tauri）：
   - `core/logger.ts` 增加"落盘"分支：开启时把 warn/error（可含 info）追加写入
     userData/logs/naotu.log（经现有 `get_user_data_dir` + 追加写 Rust command
     `append_text_file`，或复用 write_text_file 读取再合并——推荐加轻量 append command，
     避免竞态），**Web 端开关保持禁用**（浏览器无持久日志目录）。
   - 设置切换即时生效；写失败 toast（不静默）。日志文件轮转不做（本期不扩项）。
3. i18n：四语言补 `settings.chooseFolder`/`settings.clearFolder`/`settings.logsHint` 等新键，
   复用已有 `settings.savePath`/`settings.saveLogs`。
4. 测试：config 校验 defSavePath 为 string；`logger` 相关纯逻辑（是否开启落盘、路径构造）
   配单测；Rust `cargo check`。

**红线**：Web 端不伪造路径能力（保持 disabled + comingSoon 文案）；日志不得含 API key；
追加写必须 Rust command + AppResult。
**验证**：两端 `pnpm verify`；`cargo check`；GUI 手动：选目录后另存为默认落在该目录；
开日志开关后 userData/logs/naotu.log 有内容。
**涉及文件**：两端 `stores/config.ts`、`views/SettingsView.vue`、`core/file.ts`、
`core/tauri-file.ts`、`core/logger.ts`、`commands.rs`/`lib.rs`、locale ×2、tests。

---

## C 批：能力增强

### C3 — 剩余 todo 快捷键裁决（先做，廉价）

**目标**：`SHORTCUT_REGISTRY` 中 status:'todo' 的项在 ShortcutsView 以"(待实现)"灰显。
裁决其去留，避免 UI 长期承诺实现不了的能力。

**现状（已核实，`core/shortcuts.ts`）**：todo = selectAll(Mod+A)、bold(Mod+B)、
italic(Mod+I)、newline(Shift+Enter)、layoutInOrder(Mod+0)、dblClickSpace。
前四项需要富文本/多选/选区编辑——与已回退的"双击内联编辑"设计冲突，短期内**不建议实现**。

**规格**：
1. 在 ShortcutsView/registry 保留展示，但把 desc 与状态文案调整为"规划中/已取消"的诚实措辞
   （加 i18n `shortcut.statusTodo` 之类），并**移除**与编辑器真实能力冲突的误导性说明。
2. 若成本足够低可顺手做：`layoutInOrder`(Mod+0) 直接映射到现有 `mm.fit()`（与 Mod+Enter
   的 placeRoot 语义合并即可——**二选一保留一个入口**，避免重复绑定；建议保留 Mod+Enter
   并在 registry 里删掉 Mod+0 或标注为同一行为）。
3. 其余项显式标记为"未规划"，写入 HANDOFF.md 决策记录（谁决定、为什么）。
4. 测试：shortcuts.spec 维持 registry 与页面一致；若有删键则同步 descKey。

**红线**：不引入富文本编辑器；不改快捷键注册机制（registry 单一数据源）。
**验证**：两端 `pnpm verify`。
**涉及文件**：两端 `core/shortcuts.ts`、`views/ShortcutsView.vue`、locale、tests。

### C1 — MCP 桌面实时桥接 + HTTP 鉴权 + 客户端配置示例（大，先设计后实施）

**目标**：让外部 MCP 客户端操作**运行中**的桌面文档（读当前脑图、写节点且经命令栈），
并给 HTTP server 加鉴权。当前 stdio/HTTP server 只读启动时 `DESKTOP_NAOTU_MCP_CONTEXT`
快照，未与运行中文档同步。

**交付分两个 gate**：
- **Gate 1（设计文档，禁止先写代码）**：在 `docs/mcp-live-design.md`（新）产出：
  1. 拓扑：选择"桌面进程内嵌 loopback HTTP/WS listener"（推荐：Tauri 主进程起
     tokio listener 绑定 127.0.0.1:随机端口，启动时生成随机会话 token，经 stdout/
     userData 配置文件公布给客户端）或"外部 server + 状态文件/事件桥"；给出取舍。
  2. 鉴权：HTTP 必须携带 `Authorization: Bearer <token>`，无/错 token 返回 401/403；
     token 每次启动重新生成；说明防 CSRF/本机扫描的边界。
  3. 写操作链路（红线：必须经 store actions/命令栈）：Rust 收到 `tools/call` →
     emit 到目标窗口 → webview `App.vue` 现有 `handleMcpRpcRequest` 执行 → 结果经
     `mcp_rpc_response` 事件回 Rust → 应答客户端；明确**多窗口时目标选择规则**
     （focused？label？还是单一文档模型），并给出"与当前文档不一致"的错误码。
  4. 读操作：`resources/read` 的 context 改为请求时实时生成（复用
     `createMcpContext(doc)`），不再用启动快照。
  5. 兼容性：stdio server `desktop-naotu-mcp` 与 HTTP server `desktop-naotu-mcp-http`
     的取舍（保留 as-is 仅补鉴权/实时，或重构），`Cargo.toml` 多 binary 与
     `default-run` 不受影响。
  6. 客户端示例：Claude Desktop / Cursor / Cline 的 mcp 配置示例放 `docs/mcp-clients.md`。
- **Gate 2（实现）**：设计确认后按文档实施，每步过既有验证；MCP 协议层单测
  （`core/mcp.ts` spec 已存在，扩 tools/call 写路径）+ Rust `mcp.rs` 单测 + curl
  端到端冒烟（HTTP + token）。

**红线**：写操作只能经 store actions（命令栈入栈）；WebView 无 Node API；
token 不入日志；body 上限 1 MiB 维持。
**验证**：两端 `pnpm verify`；`cargo check/test`；curl 带/不带 token 的正反例；
GUI 打开文档后用外部 HTTP 工具读 mindmap://current 得到**实时**内容。
**涉及文件**：Gate 1 产 `docs/*.md`；实现阶段按设计落 `mcp.rs/mcp_http.rs/commands.rs/
lib.rs`、两端 `core/mcp.ts`、`App.vue`、capabilities、Cargo.toml（如需）、tests。

### C2 — API key 迁移到 OS 凭据管理器（大，先出设计决策）

**目标**：现在 `aiApiKey` 明文存 localStorage/config（HANDOFF 已标注隐患）。桌面端迁移到
OS 凭据管理器；Web 端保持 localStorage 但明确标注为"仅 Web 演示"。

**规格（设计决策先行，记录到 docs/）**：
1. 选型：Rust `keyring` crate（Windows Credential Manager / macOS Keychain / Linux
   Secret Service）或 Tauri plugin（stronghold 偏 vault 场景）。给出 Windows 下依赖与
   CI 影响说明后由执行 AI 选定一种并写理由。
2. Rust 新增 `set_secret/get_secret/delete_secret`（async + AppResult，key 命名如
   `desktop-naotu/ai-api-key`）；`config.ts` 的 `aiApiKey` 不再持久化进 config JSON
   （桌面端从 keyring 读入内存、写时即写 keyring）；Web 端 isTauri() 分支照旧 localStorage。
3. 设置页：密码框行为不变（内存态），保存时桌面写 keyring；加"测试连接"仍复用现有 AI 通道。
4. 安全边界：key 不落日志、不落 config 文件、不出现在 MCP context；
   keyring 不可用（Linux 无 secret service）时降级 toast 提示而不是崩溃。
5. 测试：Rust 单测 mock 层或冒烟（真实 keyring 在 CI 可能不可用——写明降级策略）；
   前端 config spec 更新。

**红线**：AI endpoint/model 仍存 config 无妨，仅 key 迁移；不得把 keyring 值写回 JSON。
**验证**：`cargo check/test`；GUI：桌面设置保存 key → 重启后仍在（读自 keyring）；
config JSON 无明文 key。
**涉及文件**：`src-tauri/Cargo.toml`、`commands.rs`/`lib.rs`、两端 `stores/config.ts`、
`views/SettingsView.vue`、`core/ai.ts`（如读 key 逻辑变化）、tests、docs/。

---

## 执行约定（执行 AI 必读）

1. **顺序**：按"推荐执行顺序"逐项完成；每完成一项立即做以下收尾，**不要攒批**。
2. **收尾模板**（追加到 HANDOFF.md，仿既有 S1/S2 完成记录格式）：
   - 目标与设计一句话；修改文件清单；验证结果（两端 test 数）；仍需人工确认的点；
     本项状态：完成/部分（写明剩余）。
3. **两端同步**：涉及共享前端文件的改动必须 Web/Tauri 同步并分别 `pnpm verify`；
   发现 A1 清单外的意外漂移立即按 A1 分类处理并记录。
4. **质量门禁**：任何提交前 两端 `pnpm verify` 全绿；Rust 改动加 `cargo fmt -- --check`、
   `cargo check`、`cargo test`、`cargo clippy --all-targets -- -D warnings`。
5. **红线**：遵守两端 AGENTS.md（分层、命令栈、markmap 收口、i18n 四语言、
   禁 alert/confirm、禁 Node API in webview、command 三件套、错误不静默）。
6. **不要做**：不删除 `legacy/`；不在 legacy 开发；不擅自杀用户运行中的实例；
   不重新打包 installer（除非用户明确要求）；不把"需人工 GUI 确认"标成已完成。
7. **改动 >200 行或跨模块**：先在本会话给出方案说明影响范围（AGENTS 协作规范），
   不要闷头一次提交超大 diff。
8. **发现文档/计划与代码冲突**：以代码实际行为为准修正本文档并在 HANDOFF.md 记录，
   不要臆测。
