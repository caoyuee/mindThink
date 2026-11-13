# docs/decisions.md — 架构决策记录（ADR）

> 记录 mindThink 的关键架构决策。每个决策含：背景、选项对比、决定、后果与风险。
> 状态：**待用户最终确认** 的决策标注 ⏳；已确认的标注 ✅；部分实施标 🟡；前提失效待重定调标 ⏸。
> 执行 AI 领取任务前，先确认对应决策的状态。

---

## D1 · 脑图内核：markmap → simple-mind-map ✅（2026-11-13 用户确认，M1 为下一里程碑）

**背景**：markmap 是「Markdown 渲染器」而非「脑图编辑器」，缺节点样式/图标/超链接/富文本/多布局/主题/拖拽/多选/关联线/小地图，补齐成本高于换内核。

**选项**：
| 选项 | 评估 |
|---|---|
| A. 继续 markmap | 死路：补齐功能 = 自研编辑器 |
| B. **simple-mind-map**（wanglin2/mind-map） | 编辑器定位、插件化控体积、8 布局、富节点、AI 工具调用先例、框架无关 |
| C. 自研内核 | 6-12 个月起步，当前不必要 |

**决定**：换 simple-mind-map（MIT 开源）。2026-11-13 用户确认启动 M1。

**确认依据（v0.1.0 后期实证）**：markmap 0.18 作为「Markdown 渲染器」已连续引发补丁——节点 `foreignObject` 吞掉 dblclick 事件、`scrollWidth` 测量使 CSS 截断不可行（截断只能做在数据投影层）、`state.key` 含内容哈希导致改名后高亮引用旧节点对象。继续在渲染结果上打补丁的边际成本已高于换内核的一次性成本。

**架构落地**：保留内部 `MindNode` 树 + `CommandStack`（兑现「换脑图库不影响命令栈」的设计意图）。新增 `core/renderer-bridge.ts` 适配层做 `MindNode ⇄ simple-mind-map 数据模型` 双向转换。内核只允许出现在 `MindEditor.vue` + renderer-bridge 两处。

**后果**：
- 首批启用插件：Drag / Select / Search / Export / KeyboardNavigation / MiniMap / Formula。
- 延后：RichText（Quill 体积大，M2 评估）、Cooperate（Yjs 协同，远期）、Demonstrate。
- 风险：上游节奏依赖 → 锁版本 + 适配层隔离 + fork 预案（MIT 可 fork）。
- 交互回归（选中/撤销/快捷键曾出事故）→ M1 专项回归清单，新内核自带能力替代旧 hack。

---

## D2 · 文档格式：双格式策略 ⏳

**背景**：纯 .md 无法承载节点样式/图标/图片/优先级；纯 JSON 对 AI/人不友好。

**选项**：
| 选项 | 评估 |
|---|---|
| A. 纯 .md | AI/人友好，但补 G1 后丢数据 |
| B. **工作格式 .mmap（JSON）+ 交换格式 .md** | 保真 + 通用语兼顾 |
| C. 学 .mt 极简纯文本 | AI 最易写，但破坏 .md 用户承诺、表达力弱 |

**决定**：方案 B。
- 工作格式 `.mmap`：`{ format: 1, root: MindNode, styles, view }`，schema 版本化 + 向前兼容测试是硬要求。
- 交换层 `.md` 一等导入导出（树+文本+备注+checkbox 无损，样式降级忽略）；`.km`（已有 round-trip）；`.xmind` 导入（借 simple-mind-map 生态）；`.mt` 导入（姿态性支持）。
- 官方发布 `SKILL.md`（仿 MindMap MT 的 skills/mindmap-format），教任意 LLM 读写 .md 映射格式。

**后果**：既有 `.md` 用户承诺不破坏——`.md` 继续可开可存；只有用到富样式的文档才需另存 `.mmap`（保存时提示一次）。

---

## D3 · 工程结构：monorepo 合并 ✅（2026-11-07 用户批准 M0-6 方案后落地）

**背景**：双工程手工复制 + parity 事后检查 = 结构性放血（已发生 6 次事故漂移）。

**决定**：
```
mindThink/
├── apps/
│   ├── web/          # 纯浏览器版（薄壳：file.ts 走 FS Access）
│   └── desktop/      # Tauri 壳（薄壳：file.ts 走 invoke + Rust）
├── packages/
│   ├── ui/           # 组件 + 视图 + composables + styles（共享主体）
│   ├── core/         # tree/commands/km/ops/mcp-server/mcp/display/shortcuts（纯 TS，零 Vue 依赖）
│   └── i18n/         # 仅装配逻辑；8 份 locales 属平台分歧，仍留各 app
└── build/            # @/ 别名单一事实源（parity 脚本已退役）
```

**纪律**：迁移以「先移动、不改逻辑」为原则，一次大 PR + 全量 verify；parity 脚本退役；Rust 侧不动。

---

## D4 · AI 集成：三级演进 ⏸（前提变化，待重新确认）

**现状（2026-11-13）**：内置 AI 对话（L1 问答助手 + `core/ai.ts` + AiAssistant.vue + ai* 配置）已被用户要求**整体删除**（commit `344c3e6`）。当前无内置 AI、无 API key、无 endpoint/model 配置。

**已提前落地的部分**：`MindMapOp` schema 随 M3 阶段一实现于 `packages/core/src/core/ops.ts`（`parseMindMapOps` / `applyOpsToDoc`），当前操作集为 `add_child / add_sibling / update_node / delete_node`；写入经 MCP `apply_ops` → 批准对话框（fail-closed）→ 命令栈（一次调用 = 一个撤销单元）。**这正是原 L2 的 schema 与写入安全模型**，只是来源从内置 AI 换成了外部 Agent。

**L2 待重定调（M2，决策前不派工）**：
- 选项 A：恢复内置 AI，必须复用 `core/ops.ts` 同一 schema + 批准门控，禁止另开写入通道；再补多协议适配、diff 预览面板、场景工具箱。
- 选项 B：砍掉内置 AI，M2 改为「纯外部 Agent / MCP 驱动」，把精力放在 M3 余项（多窗口目标选择）与 M4（MCP Client + Agent 会话）。
- 原 `core/ai-ops.ts` 文件名不再使用；`restyle/setPriority/setProgress` 等 op 需等 M1 富节点能力到位后再评估。

**L3 Agent 会话（M4）**：多步任务 + 步骤流 UI + 工具批准门控（单次/会话/拒绝三档）+ 外部 MCP 工具接入——不依赖内置 AI，仍成立。

**C2（API key 迁移）**：⏸ 当前无对象。若选项 A 恢复内置 AI，再出 `docs/api-key-storage-design.md`（key 迁 OS keyring，不落日志/config/MCP context）。

---

## D5 · MCP：Server 实时化 → 双向化 🟡（阶段一已实施 2026-11-10，阶段二未开始）

**阶段一（M3）：Server 实时桥接**（✅ 已实施：架构为「Rust 纯传输层 + webview 协议层」，见下）
- 拓扑：Tauri 主进程内嵌 loopback Streamable HTTP listener（JSON 变体：notification 回 202），`127.0.0.1:随机端口`，端口+token 写入 userData/mcp-discovery.json。
- 鉴权：Bearer token（/dev/urandom），每次启动轮换；未带/错 token → 401；Host 头校验防 DNS rebinding。
- 分层（实施落地）：Rust（`src-tauri/src/mcp_server.rs`）只做传输 + 鉴权 + 桥接（emit `mcp-request` ↔ invoke `mcp_respond`，30s 超时）；协议与业务全部在 webview（`packages/core/src/core/mcp-server.ts` 的 `handleMcpServerRpc` + `core/ops.ts` 的 MindMapOp schema）。
- 写链路（红线）：`tools/call: apply_ops` → ops 校验（≤100 条/批）→ **批准对话框逐条列出（fail-closed，可设置自动批准）** → 命令栈一次落盘（一个撤销单元）→ 结果回传。
- 读链路：`tools/list` / `resources/read` 复用 `createMcpContext(doc)` 实时生成，无快照。
- 工具面：读类 `query_tree/get_node/search_nodes/export_markdown` + 写类 `apply_ops`（MindMapOp schema，D4 L2 未来复用同一 schema）。
- 交付 `docs/mcp-clients.md`：Claude Desktop / Cursor / Cline 配置示例 + 一键复制 `mcp add` 命令（设置页）。
- Rust 验证：`src-tauri/src/mcp_server.rs` 单测 9 个（token/401/403/404/桥接/202/400）；沙箱无 cargo，用户本机四件套结果待回填。

**阶段二（M4）：Client 方向**
- 设置页挂外部 MCP server（stdio 经 Rust 子进程 / streamable HTTP）。
- 工具列表合并外部 MCP tools，调用走批准门控（单次/会话/拒绝三档）；内置 AI 已移除，此方向不再依赖它。

**协议注意**：MCP 官方现行规范为 Streamable HTTP（含会话管理），旧 HTTP+SSE 已废弃。现有 `POST /mcp` 单行 JSON 是自定义简化实现，M3 升级或声明兼容策略。

---

## D6 · UI：专注工作室（Focused Studio）设计系统 ✅（2026-11-13 随 M1 一并确认）

**定调**：极简留白 + 单一强调色 + 精确间距的工具类方向（brutally-minimal 象限，参考 Linear/Affinity 工作台气质）。

**规格**：
| 层 | 规格 |
|---|---|
| 色彩 | 60/30/10；中性底色 + 单强调色（墨蓝）+ 琥珀作「智能信号色」（AI/MCP 相关交互）；画布主题与 chrome 主题解耦 |
| 字体 | 展示层（App 名/空态）用个性字；正文/节点用系统 UI 字体栈；节点字号 ≥13px；等宽字用于 id/路径/快捷键 |
| 间距/圆角 | 4px 基准网格；chrome 圆角 6px；阴影 3 级（2/8/24px） |
| 动效 | 微交互 150-200ms / 面板 300-400ms / diff 高亮入场 600ms；全部 `prefers-reduced-motion` 降级；缓动 `cubic-bezier(0.16,1,0.3,1)` |
| 焦点 | 全键盘可达，44×44px 触达，可见 focus ring |

**布局**：顶栏（文档/dirty/布局切换/主题/搜索/AI 入口）+ 左大纲 + 中画布（小地图/缩放常驻角落）+ 右「上下文面板」（节点属性 ↔ AI 预览 ↔ MCP 活动按需切换）+ 状态栏。

**关键交互**：节点双击内联编辑（rAF 延迟解决历史竞态）、拖拽落点预览线、AI diff 入场 stagger（80ms）、空态模板选择、命令面板 Mod+K（远期）。
