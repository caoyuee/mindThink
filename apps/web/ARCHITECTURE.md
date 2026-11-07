# ARCHITECTURE.md — 架构总览

## 1. 系统上下文

```
┌────────────────────────────────────────────────────┐
│                  用户(脑图使用者)                 │
└─────────────────────┬──────────────────────────────┘
                      │
┌─────────────────────▼──────────────────────────────┐
│         桌面应用 (Tauri 2.x · 远期)                │
│  ┌──────────────────────────────────────────────┐  │
│  │           Webview (Chromium)                 │  │
│  │  ┌────────────────────────────────────────┐  │  │
│  │  │       SPA (Vue 3 + Pinia + markmap)    │  │  │
│  │  │                                        │  │  │
│  │  │   Components → Stores → Core → Types    │  │  │
│  │  └────────────┬───────────────────────────┘  │  │
│  │                 │ IPC (invoke / event)        │  │
│  └─────────────────┼────────────────────────────┘  │
│                    │                              │
│  ┌─────────────────▼────────────────────────────┐  │
│  │     Tauri Main (Rust)                        │  │
│  │     - 文件 IO                                │  │
│  │     - 系统菜单/对话框                        │  │
│  │     - MCP Server (远期)                      │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

**当前阶段 (spike)**: Webview 部分先行验证，Tauri 部分下一阶段。

## 2. 模块依赖图

```
┌──────────────────────────────────────────────────┐
│                App.vue                           │  ← 主布局
│                                                  │
│   ┌─────────────────────────────────────────┐    │
│   │  Toolbar.vue    Properties.vue           │    │
│   │  MindEditor.vue ←──→ NodeContextMenu.vue│    │
│   └─────────────────────┬───────────────────┘    │
│                         │                        │
│   ┌─────────────────────▼───────────────────┐    │
│   │          stores/mindmap.ts               │    │
│   │  (Pinia: 状态 + 命令栈 + actions)        │    │
│   └──────┬─────────────┬────────────────┬────┘    │
│          │             │                │         │
│   ┌──────▼───┐  ┌──────▼────┐  ┌────────▼────┐   │
│   │ core/    │  │ core/     │  │ core/       │   │
│   │ tree.ts  │  │ commands  │  │ file.ts     │   │
│   └──────────┘  └───────────┘  └─────────────┘   │
│          │             │                │         │
│   ┌──────▼─────────────▼────────────────▼────┐   │
│   │  types/  markmap.d.ts, tree.d.ts, ...    │   │
│   └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

## 3. 数据流

### 3.1 用户编辑节点

```
用户在 markmap 上右键节点
        ↓
MindEditor.vue 触发 onSvgContextMenu
        ↓
弹出 NodeContextMenu.vue，用户点击"添加子节点"
        ↓
emit 'action' -> MindEditor.vue.onMenuAction
        ↓
调用 store.addChild(nodeId)
        ↓
store.applyEdit() 记录 before/after 快照
        ↓
CommandStack.executeUpdate() -> setDoc()
        ↓
doc.value 变化 -> markmapData computed 重算
        ↓
MindEditor.vue watch markmapData -> mm.setData()
        ↓
markmap 重新渲染 SVG
```

### 3.2 撤销

```
用户按 Ctrl+Z
        ↓
MindEditor.vue window keydown handler
        ↓
store.handleKey() -> store.undo()
        ↓
CommandStack.undo() -> setDoc(cmd.undo())
        ↓
doc.value 变化 -> markmapData 变化 -> 重渲染
```

### 3.3 加载 Markdown

```
用户点击"打开"按钮
        ↓
Toolbar.vue -> store.open()
        ↓
core/file.ts.openFile() 走 FS Access API
        ↓
拿到 Markdown 字符串 -> store.loadFromMarkdown(md)
        ↓
markmap-lib Transformer.transform(md) -> IPureNode
        ↓
mmToMind() 转成内部 MindDoc
        ↓
doc.value = 新 MindDoc + stack.clear()
        ↓
markmapData computed 触发 -> markmap 重渲染
```

## 4. 关键抽象

### 4.1 MindNode

```typescript
interface MindNode {
  id: string; // 稳定 ID, 命令栈用
  text: string; // 节点文本
  note?: string; // 备注（远期）
  children: MindNode[];
  meta?: Record<string, unknown>; // AI/扩展预留
}
```

**设计意图**:

- `id` 与 markmap 解耦，换脑图库不影响命令栈
- `meta` 是 AI 写入自定义数据的扩展点（如优先级、颜色、图标）

### 4.2 CommandStack

```typescript
class CommandStack {
  undoStack: Command[];
  redoStack: Command[];
  maxHistory: number = 100;
}
```

**特点**:

- 快照式（非 diff），简单可靠
- 100 操作上限（防止内存爆炸）
- 命令对象纯数据可序列化（远期可持久化/同步给 AI）

### 4.3 markmap 桥接

```typescript
// MindNode → IPureNode
toMarkmapNode() 在 store 层一次性转换, MindEditor 只关心 IPureNode

// 节点点击反查 ID
payloadOf(target) 通过 closest('g.markmap-node') + __data__.data.payload.id
```

**解耦**: store 不直接操作 markmap，组件不直接写树结构。

## 5. 状态管理

| 状态            | 位置                     | 持久化                |
| --------------- | ------------------------ | --------------------- |
| `doc` (MindDoc) | store                    | 文件 (Markdown)       |
| `selectedId`    | store                    | 不持久化              |
| `theme`         | store + DOM `data-theme` | 可扩展到 localStorage |
| 撤销/重做栈     | store                    | 不持久化              |
| 窗口大小/位置   | （远期）Tauri 状态       | OS userData           |

## 6. 错误处理

```
core/*    抛出原始错误
   ↓
store/*  捕获并 logger.error, 必要时返回 false
   ↓
components/* 显示用户友好提示
```

## 7. 远期架构演进

### Phase 2: Tauri 接入

- `core/file.ts` 改写为 `invoke('read_file')` / `invoke('save_file')`
- 新增 `core/sys.ts`: 系统菜单、对话框
- 新增 Rust 后端 `src-tauri/`

### Phase 3: MCP Server

- 新增 Rust crate `mindmap-mcp/`
- 暴露 `mindmap://current`、`mindmap://node/<id>` 资源
- 工具: `add_node`、`update_node`、`remove_node`、`expand`、`summarize`

### Phase 4: 内置 AI 对话

- 新增 `components/ChatPanel.vue`
- 新增 `core/llm.ts`: OpenAI/Claude/DeepSeek 适配
- 流式输出 (SSE)
- 节点上下文注入

## 8. 性能边界

| 规模            | 行为                                                  |
| --------------- | ----------------------------------------------------- |
| < 100 节点      | 流畅                                                  |
| 100-1000 节点   | markmap 渲染 < 100ms, 可接受                          |
| 1000-10000 节点 | markmap 首次渲染 ~500ms, 缩放可能卡顿（d3-hierarchy） |
| > 10000 节点    | 需要虚拟化或分片（超出 spike 范围）                   |

## 9. 安全

- **CSP**: 由 Tauri 提供，前端不引入 unsafe-eval
- **文件 IO**: 仅限用户主动选择的文件，无通配符路径
- **AI 调用**: API Key 仅存 OS keychain，不进文件（远期）
