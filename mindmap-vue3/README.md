# mindThink · Web 端

> 本项目已更名为 **mindThink**（原 DesktopNaotu）。
> 本目录 `mindmap-vue3/` 是 **Web 端**（迭代开发主战场，前端能力基线）。

## 定位

- 纯浏览器运行的思维导图 Web 客户端。
- 前端能力基线：所有共享的前端代码在此先行开发，再同步到 `../tauri-spike/`。
- 产品定位与技术栈见 [`../README.md`](../README.md)。

## 必读文档（开发前）

| 文档 | 何时读 |
|---|---|
| [`../README.md`](../README.md) | 第一次接触项目 |
| [`../AGENTS.md`](../AGENTS.md) | 修改任何代码前（**统一规则基线**） |
| [`../docs/decisions.md`](../docs/decisions.md) | 了解架构决策 D1-D6 |
| [`../docs/architecture.md`](../docs/architecture.md) | 修改跨模块代码前 |
| [`../docs/roadmap.md`](../docs/roadmap.md) | 领取开发任务前 |

> 本目录内的 `ARCHITECTURE.md` 描述 markmap 时代的现状架构；`CONVENTIONS.md` 为代码风格约定；二者与根 `AGENTS.md` 冲突时，以根 `AGENTS.md` 为准。

## 快速开始

```bash
pnpm install
pnpm dev        # http://localhost:5180
pnpm verify     # parity + typecheck + lint + format:check + test（提交前必过）
```

## 目录要点

- `src/stores/mindmap.ts` — 状态 + 命令栈 + actions（一切写入的唯一通道）
- `src/core/` — 纯 TS 函数（tree/commands/km/mcp/ai/shortcuts/file）
- `src/components/editor/MindEditor.vue` — 脑图内核集成收口点
- `src/types/` — 类型定义（markmap 类型收口于 `markmap.d.ts`）

## 许可

[GPL-2.0](../LICENSE)
