# docs/architecture.md — 目标架构与数据流

> 本文描述 mindThink 的**目标架构**（含规划演进方向）。现状架构详见两工程各自的 ARCHITECTURE.md（markmap 时代，部分描述已过时），目标架构在 M1 内核切换后生效。
> 关键抽象（MindNode / CommandStack）在现状与目标间保持不变，这是「换内核不影响命令栈」设计意图的兑现。
>
> **2026-11-13 校准（以 v0.1.0 代码为准）**：内置 AI 已移除；应用为单页（设置/快捷键/关于是弹窗，无 router）；MCP Server 阶段一已落地（Rust 纯传输 + TS 协议层）；格式仅 `.md` / `.km`；MCP 写链路目前仅支持单窗口。下图标 `（现状）` 的部分为已实现，`（M1/M2 规划）` 为目标。

## 1. 系统上下文

```
┌────────────────────────────────────────────────────────────┐
│                         用户（脑图使用者）                    │
└────────────┬───────────────────────────────┬───────────────┘
             │                               │
   ┌─────────▼─────────┐           ┌─────────▼─────────────────┐
   │  用户（直接编辑）   │           │   外部 Agent（Claude/Cursor）│
   │  工具栏 / 双击编辑  │           │   经 MCP 提交 MindMapOp[]  │
   └─────────┬─────────┘           └─────────┬─────────────────┘
             │         两类写入统一入口         │
             └───────────────┬───────────────┘
                             ▼
              ┌──────────────────────────────┐
              │        Diff 预览 / 批准门      │  ← 用户批准后放行
              └──────────────┬───────────────┘
                             ▼
              ┌──────────────────────────────┐
              │   stores/mindmap.ts           │
              │   applyEdit() → CommandStack  │  ← 一切写入唯一通道
              └──────────────┬───────────────┘
                             ▼
              ┌──────────────────────────────┐
              │      MindNode 文档树           │  ← 唯一事实源
              └───┬──────────┬───────────┬───┘
                  │          │           │
         ┌────────▼──┐  ┌────▼─────┐  ┌──▼─────────┐
         │ 画布渲染   │  │ 持久化    │  │ MCP 读取   │
         │ renderer- │  │ .md/.km  │  │ resources  │
         │ bridge    │  │          │  │ 实时生成   │
         └───────────┘  └──────────┘  └────────────┘
```

## 2. 关键抽象（现状与目标通用）

### 2.1 MindNode

```typescript
interface MindNode {
  id: string;          // 稳定 ID，命令栈用
  text: string;        // 节点文本
  note?: string;       // 备注
  children: MindNode[];
  meta?: Record<string, unknown>; // 扩展预留（样式/图标/优先级/进度）
}
```

- `id` 与内核解耦，换库不影响命令栈。
- `meta` 是扩展点；D2 工作格式 `.mmap`（M1 规划）会显式化样式字段。

### 2.2 CommandStack

快照式（非 diff）撤销/重做；命令对象纯数据可序列化（不持闭包），供 MCP 操作回放；上限 100 操作防内存爆炸。

### 2.3 renderer-bridge（M1 新增）

```typescript
// MindNode ⇄ simple-mind-map 数据模型 双向转换
mindToRenderer(root: MindNode): RendererData
rendererToMind(data: RendererData): MindNode
```

- 内核只允许出现在 `MindEditor.vue` + 本文件。
- round-trip 转换必须有单测覆盖（保层级、样式、meta 无损）。

## 3. 数据流

### 3.1 用户编辑节点（现状与目标一致）

```
用户操作（点击/右键/拖拽/快捷键）
  → MindEditor.vue 事件处理
  → store.addChild(nodeId) / updateNote / reorderNode ...
  → applyEdit() 记录 before/after 快照
  → CommandStack.executeUpdate() → setDoc()
  → doc.value 变化 → renderer 数据重算
  → renderer-bridge 转换 → 内核重渲染
```

### 3.2 结构化写入（现状：MCP apply_ops；M2 待重定调）

```
外部 Agent 经 MCP 提交 MindMapOp[]
  → ops 校验（core/ops.ts：parseMindMapOps，≤100 条/批）
  → 批准对话框逐条列出改动（fail-closed，可配置自动批准）
  → 用户批准后在 applyEdit 闭包内对「当时」的文档应用 ops
    （批准是 async，期间文档可能变化，不可用预计算快照）
  → 一次调用 = 一个撤销单元 → renderer 重渲染
```
> 内置 AI 已移除；未来若恢复，必须复用同一 schema 与批准门控（见 docs/decisions.md D4）。
> 画布 diff 高亮 / 侧栏逐条采纳属 M2 规划，当前批准对话框为文本摘要。

### 3.3 MCP 写链路（M3）

```
外部 Client → Streamable HTTP (127.0.0.1:随机端口, Bearer token)
  → Rust 校验 token（失败 401/403）
  → 单窗口（现状；M3-5 多窗口目标选择未做）
  → emit 到 webview
  → 前端 ops 校验 + Diff 预览批准（fail-closed）
  → store actions 写命令栈
  → 结果经事件回 Rust → 应答 Client
```

### 3.4 加载与保存

```
打开：文件 → core/file.ts（Web FS Access / Tauri invoke）
  → 按扩展名路由（现状 .md / .km；.mmap / .xmind 为 M1 规划）
  → 转 MindNode → 替换 doc + stack.clear

保存：doc → 按工作格式/交换格式序列化
  → core/file.ts 写盘
```

## 4. 状态管理

| 状态 | 位置 | 持久化 |
|---|---|---|
| `doc`（MindNode 树） | store | 文件（.mmap / .md） |
| `selectedId` | store | 不持久化 |
| `theme` | store + DOM `data-theme` | config |
| 撤销/重做栈 | store | 不持久化 |
| MCP 配置（mcpEnabled / mcpAutoApproveWrites） | config store | config JSON |
| MCP token | 内存（每次启动轮换） | 不持久化 |
| 弹窗开关（settings / shortcuts / about） | ui store | 不持久化 |

## 5. 错误处理

```
core/*    抛出原始错误
store/*   捕获并 logger.error，必要时返回 false
components/*  显示用户友好提示（toast / dialogs）
```

## 6. 安全边界

- 一切写入经命令栈（可撤销、可审计）。
- MCP 写操作 fail-closed（默认需 diff 批准）。
- 当前无 API key / 无凭据配置；MCP token 只存内存，不落 config / 日志 / discovery 以外文件。
- WebView 无 Node API；文件 IO 仅限用户主动选择的文件。

## 7. 性能预算（约束级）

| 规模 | 行为 |
|---|---|
| < 100 节点 | 流畅 |
| 100-1000 节点 | 渲染 <100ms，可接受 |
| 1000-10000 节点 | 首次渲染 <500ms，可交互 |
| > 10000 节点 | 需虚拟化/分片（超出当前范围） |
| 安装包 | <25MB（Tauri） |
