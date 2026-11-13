# docs/roadmap.md — 可派工路线图

> 本文是开发任务的**派工清单**。每个任务含：ID、目标、规模、依赖、验收标准。
> 领取任务前必须：① 读根 `AGENTS.md`；② 确认对应决策状态（docs/decisions.md）；③ 按 superpowers 流程写实施计划后再动工。
> 完成每个任务后，在 `docs/archive/HANDOFF-*.md` 追加完成记录（目标/修改文件/验证结果/待人工确认）。

## 任务状态图例

- ✅ 已完成 · 🔵 待派工 · ⏳ 设计中（需先出设计文档 gate） · 🛑 人工门槛（执行 AI 不做） · ⏸ 前提失效/待重定调

---

## M0 · 工程收口（✅ 已随 v0.1.0 发布）

> 目标：清掉欠账，让主线干净进入 M1。依赖：无（可并行派工）。

| ID | 任务 | 规模 | 依赖 | 状态 |
|---|---|---|---|---|
| M0-1 | P0 GUI 实机回归（含新增：双击就地编辑 / 三个弹窗 / Insert 子节点 / MCP 批准） | 人工 | 无 | 🛑 |
| M0-2 | 出包：CI 推 `v*` tag 自动构建 Win/Linux；本机 `pnpm build:tauri` 冒烟 | 小 | M0-1 | 🛑 |
| M0-3 | B3 自动备份保留策略与旧备份清理 | 中 | 无 | ✅ |
| M0-4 | B2 Recent Files 原生子菜单 | 中 | B1（已 done） | ✅ |
| M0-5 | B4 defSavePath 生效 + 日志落盘开关 | 中 | 无 | ✅ |
| M0-6 | D3 monorepo 合并（先移动不改逻辑） | 中-大 | D3 确认 | ✅ |

### M0-3 规格（B3 备份保留策略）

- **Rust**：`list_backup_files(path)`（匹配 `basename.backup-*` 降序）、`delete_files(paths)` → 三件套注册。
- **前端**：`core/file.ts` 加 `pruneBackups(path, keep)`；`config.ts` 加 `backupKeepMax`（默认 20，1-100 校验，仿 `recentMaxNum`）；`save({backup:true})` 成功后 prune；`SettingsView.vue`（现为 `SettingsDialog.vue`）加 number input。
- **i18n**：4 语言 `settings.backupKeepMax` / `settings.backupKeepMaxHint`。
- **测试**：`backup.spec.ts`（构造/解析 stamp、排序、超限裁剪）+ config 校验。
- **红线**：只匹配 `.backup-*` 命名防误删；删除失败 toast 不静默。
- **验收**：两端 `pnpm verify` + `cargo check/test`。

### M0-4 规格（B2 Recent 子菜单）

- `core/menu-spec.ts` 扩展 Recent Files 动态子菜单（`open-recent` + `recent:<path>` + 清空项）；前端 watch recentFiles + locale 触发 rebuild（节流 300ms）。
- `App.vue::handleMenuEvent` 加 `recent:*` → `openRecent(path)`，清空 → `clearRecentFiles()`。
- **红线**：路径过长用 basename + title；不保留陈旧路径。
- **验收**：两端 verify + cargo check + GUI 手动。

### M0-5 规格（B4 defSavePath + 日志）

- `defSavePath`：设置页目录选择（dialog `open({directory:true})`）；保存对话框 `defaultPath` 优先 defSavePath；加清除按钮。
- `ifSaveLogToDisk`：开启时 warn/error 追加写 `userData/logs/naotu.log`（Rust `append_text_file` command）。
- **红线**：Web 端不伪造路径能力（保持 disabled）；日志不得含 API key。
- **验收**：两端 verify + cargo check + GUI 手动。

### M0-6 规格（D3 monorepo）

- 建 `apps/web`、`apps/desktop`、`packages/ui`、`packages/core`、`packages/i18n`；移动文件不改逻辑；一次大 PR + 全量 verify；parity 脚本退役；Rust 不动。
- **验收**：monorepo 下两端 verify 全绿；Tauri build 正常。

---

## M1 · 内核升级 + 设计系统（**下一里程碑**，2026-11-13 用户确认启动，版本待定）

> 目标：换 simple-mind-map 内核，功能对齐 kityminder 基本面，视觉脱胎换骨。
> **这是唯一动渲染核心的里程碑，之后全部基于稳定内核做增量。**
> 依赖：D1、D6 已确认（2026-11-13）；D2（.mmap 双格式）需在 M1-7 前确认。
> 决策背景：v0.1.0 后期连续 5 个提交都在绕 markmap 的限制打补丁（dblclick 事件被吞、CSS 截断破坏 scrollWidth 布局、state.key 含内容哈希致高亮错位），继续堆 workaround 的成本已超过换内核。

| ID | 任务 | 规模 | 依赖 | 状态 |
|---|---|---|---|---|
| M1-1 | renderer-bridge 适配层 + MindNode⇄SMM 转换 + round-trip 测试 | 大 | D1 | 🔵 |
| M1-2 | 插件启用：Drag/Select/Export/KeyboardNavigation/MiniMap/Search | 中 | M1-1 | 🔵 |
| M1-3 | 主题系统接入（chrome 双主题 + 画布主题解耦） | 中 | D6 | 🔵 |
| M1-4 | 设计 token 体系（global.css 重构为 token 驱动） | 中 | D6 | 🔵 |
| M1-5 | 布局切换（逻辑/思维导图/组织/时间轴/鱼骨） | 小 | M1-1 | 🔵 |
| M1-6 | 节点富内容第一批：图标/超链接/备注/优先级/进度 | 中 | M1-1, D2 | 🔵 |
| M1-7 | 工作格式 `.mmap` schema v1 + 迁移与兼容测试 | 中 | D2 | 🔵 |
| M1-8 | 导入增强：.xmind/.mt 导入；.md 导出含样式降级 | 中 | M1-7 | 🔵 |
| M1-9 | 上下文面板布局重构 + 空态模板选择 | 中 | D6 | 🔵 |
| M1-10 | 撤销/重做与快捷键体系在新内核下回归 + 补测 | 中 | M1-2 | 🔵 |

**M1 总验收**：拖拽/多选/图标/超链接/优先级/多布局可用；10k 节点交互流畅；旧 `.md` 全部可打开；视觉评审通过（对照 docs/decisions.md D6）。

---

## M2 · AI 结构化编辑 L2（⏸ 前提待重定调）

> 目标（原）：AI 改图全链路（建议→预览→批准→撤销）。依赖：D4 确认。
> **前提变化（2026-11-10）**：内置 AI 对话已整体删除（commit `344c3e6`），「内置 AI 生成 ops」不再成立。
> M2-1 的 `MindMapOp` schema 已随 M3 阶段一在 `core/ops.ts` 落地并标 ✅；其余任务**决策前不要派工**。
> 待产品拍板：① 恢复内置 AI 并复用 ops + 批准门控；② 改走纯外部 Agent / MCP 驱动，砍掉 M2-2/5/6。

| ID | 任务 | 规模 | 依赖 | 状态 |
|---|---|---|---|---|
| M2-1 | `MindMapOp` schema + 校验器 + 单测 | 中 | D4 | ✅（2026-11-10，`core/ops.ts` + 3 组测试） |
| M2-2 | 多协议适配（OpenAI tools / Anthropic / JSON 降级） | 中-大 | M2-1 | 🔵 |
| M2-3 | Ops diff 预览面板（画布高亮 + 逐条采纳） | 大 | M2-1 | 🔵 |
| M2-4 | 逐 op 应用 + 成组撤销 | 中 | M2-1 | 🔵 |
| M2-5 | 场景工具箱：整树生成/分支扩展/分支总结/整理重排 | 中 | M2-3 | 🔵 |
| M2-6 | C2 API key → OS keyring（先出 `docs/api-key-storage-design.md`） | 中 | 设计 gate | ⏸（无内置 AI / 无 API key，暂无对象） |
| M2-7 | 官方 `SKILL.md`（教外部 LLM 写 .md 交换格式） | 小 | 无 | 🔵 |

**M2 总验收**：AI 改图全链路演示通过；错误安全（解析失败不落盘）测试覆盖。

---

## M3 · MCP Server 实时化（v0.5.0）

> 目标：Claude Desktop 实机通过 MCP 读写本机脑图。依赖：D5 确认。

| ID | 任务 | 规模 | 依赖 | 状态 |
|---|---|---|---|---|
| M3-1 | 补 `docs/mcp-live-design.md`（阶段一已先行实施，需 retroactive 记录） | 文档 | D5 | 🔵 |
| M3-2 | loopback Streamable HTTP + 轮换 token + 发现文件 | 中-大 | M3-1 | ✅（2026-11-10，mcp_server.rs） |
| M3-3 | 写链路：Rust→窗口事件→ops 校验→diff 批准→回传 | 大 | M3-1, M2-1 | ✅（2026-11-10，ops.ts + 批准对话框，单窗口） |
| M3-4 | 读链路实时化 + `query_tree/search/export_markdown` 工具 | 中 | M3-1 | ✅（2026-11-10，mcp-server.ts） |
| M3-5 | 多窗口目标选择规则 + 错误码 | 中 | M3-3 | 🔵 |
| M3-6 | `docs/mcp-clients.md` + 一键复制 `mcp add` 命令 | 小 | M3-2 | ✅（2026-11-10，设置页） |

**M3 总验收**：Claude Desktop 端到端读写演示（写操作弹 diff 批准）。

---

## M4 · MCP Client + Agent 会话 L3（v0.6.0）

| ID | 任务 | 规模 | 依赖 | 状态 |
|---|---|---|---|---|
| M4-1 | 外部 MCP server 管理（stdio/HTTP）+ 设置页 | 中-大 | D5 | 🔵 |
| M4-2 | 工具批准门控（单次/会话/拒绝三档） | 中 | M4-1 | 🔵 |
| M4-3 | Agent 会话面板（多步任务流 UI） | 大 | M4-1 | 🔵 |
| M4-4 | 场景打通：读文件→生成脑图→挂链接 demo | 中 | M4-2 | 🔵 |

**M4 总验收**：真实场景 Agent 工作流跑通（如「读取本地会议纪要→建图→总结行动项→标记优先级」）。

---

## M5 · 发布工程（v1.0.0）

| ID | 任务 | 状态 |
|---|---|---|
| M5-1 | 三平台 CI + 签名（Win/Linux CI 已随 v0.1.0 落地；macOS + 代码签名待补） | 🔵 |
| M5-2 | `tauri-plugin-updater` + 更新签名 + 回滚 | 🔵 |
| M5-3 | 官网/文档/GitHub Releases 流程 + 命令面板 Mod+K 打磨 | 🔵 |

---

## 执行约定（所有执行 AI 必读）

1. **顺序**：里程碑内任务按依赖排；每完成一项立即收尾，不要攒批。
2. **收尾**：在 `docs/archive/HANDOFF-<date>.md` 追加完成记录（目标/文件/验证/待人工）。
3. **共享代码单份**（M0-6 后）：跨端共享源码在 `packages/` 物理单份，无同步负担；平台分歧文件（App.vue / core/file.ts / stores / locales / tests）分属各 app，改动无需同步。
4. **质量门禁**：提交前 `pnpm verify` 全绿；Rust 改动加 cargo 四件套。
5. **红线**：遵守根 `AGENTS.md`（命令栈全入口、内核收口、i18n、禁 alert/confirm、禁 Node API、错误不静默）。
6. **不要做**：不删除 `legacy/`；不在 legacy 开发；不擅自杀用户运行中实例；不重打包 installer（除非明确要求）；不把「需人工 GUI 确认」标成已完成。
7. **改动 >200 行或跨模块**：先给方案说明影响范围。
8. **文档与代码冲突**：以代码实际行为为准修正文档，不要臆测。

---

## 2026-11-13 状态校准（以代码为准）

| 项 | 事实 |
|---|---|
| 版本 / tag | 全部配置 0.1.0；`v0.1.0` 已重打在 `78df6a1`，CI 由 push `v*` 触发（Windows + Linux） |
| 质量基线 | Desktop **103** / Web **96** vitest 全绿；双端 vue-tsc 0；全仓 eslint / prettier 过；Rust 四件套待本机回填 |
| 已确认决策 | D1（换 simple-mind-map）、D6（专注工作室设计系统）——**M1 为下一里程碑**，用户 2026-11-13 确认启动 |
| 待确认决策 | D2（.mmap 双格式，M1-7 前）、**D4 / M2**（内置 AI 已删，需重定调）、M3-1 设计文档补录 |
| 应用形态 | 单页（无 vue-router）；设置 / 快捷键 / 关于为弹窗；显示名「灵犀导图」/ mindThink |
| 已知小债 | `vue-router` 依赖仍留在两端 package.json（代码零引用）；`productName` 仍 `DesktopNaotu`；M3-5 多窗口目标选择未做 |

> 本轮已按代码事实对齐 `AGENTS.md`、`README.md`、`docs/roadmap.md`、`docs/decisions.md`、
> `docs/architecture.md`、`docs/mcp-clients.md`、`docs/releases/RELEASE-NOTES-v0.1.0.md`，
> 并在 `docs/archive/HANDOFF-2026-11-07.md` 补录 11-11~11-13 的完成记录。
