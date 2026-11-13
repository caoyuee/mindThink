# mindThink MCP Server 接入指南

> mindThink 桌面端（Tauri）内置一个 **Streamable HTTP**（JSON 变体）MCP server，
> 让 Claude Desktop、Cursor、Cline 等外部 AI Agent 实时读取并（经批准）修改当前思维导图。
> 对应 `docs/decisions.md` D5 阶段一。

## 能力总览

| 工具 | 类型 | 说明 |
|---|---|---|
| `query_tree` | 读 | 返回当前导图标题、节点数与完整 Markdown 树 |
| `get_node` | 读 | 按 id 读取单个节点（id / text / note / childIds） |
| `search_nodes` | 读 | 按 text/note 关键词（大小写不敏感）搜索节点 |
| `export_markdown` | 读 | 导出当前导图 Markdown |
| `apply_ops` | 写 | 批量结构化操作（add_child / add_sibling / update_node / delete_node），**默认弹窗批准**，一次调用 = 一个撤销单元 |

资源（resources）：`mindmap://current`（全文 Markdown）、`mindmap://node/{id}`（单节点 JSON）。

另有 `query_tree` 同义资源读取与 `ping` 方法；协议版本 `2024-11-05`。

## 启用与发现

1. 打开桌面端 **原生菜单「导航 → 设置」或顶栏「设置」**（v0.1.0 起设置为弹窗，不再是独立页面）→ 勾选「启用 MCP 服务器」
2. 应用在本机监听 `127.0.0.1:<随机端口>`，并在
   `userData/mcp-discovery.json` 写入发现信息：

```json
{
  "port": 52134,
  "token": "<64 位十六进制，每次启动轮换>",
  "pid": 12345,
  "started_at": 1731200000
}
```

- **鉴权**：所有请求必须带 `Authorization: Bearer <token>`，否则 401
- **安全边界**：仅监听 loopback；Host 头必须为 `127.0.0.1` / `localhost`（防 DNS rebinding）
- 写操作默认 fail-closed：应用内弹出批准对话框，逐条列出改动，用户批准后才落盘；
  可在设置弹窗开启「自动批准」（不建议对外部不可信 Agent 开启）

## 接入示例

### Claude Code / 一键 mcp add

设置弹窗点击「复制接入命令」，等价于：

```bash
claude mcp add --transport http mindthink http://127.0.0.1:52134/mcp \
  --header "Authorization: Bearer <token>"
```

### Claude Desktop（claude_desktop_config.json）

```json
{
  "mcpServers": {
    "mindthink": {
      "type": "http",
      "url": "http://127.0.0.1:52134/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

### Cursor / Cline（mcp.json）

```json
{
  "mcpServers": {
    "mindthink": {
      "url": "http://127.0.0.1:52134/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

### curl 验证

```bash
curl -s http://127.0.0.1:52134/mcp \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## apply_ops 示例

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "apply_ops",
    "arguments": {
      "ops": [
        { "op": "add_child", "parentId": "<节点id>", "text": "新主题", "note": "备注" },
        { "op": "update_node", "nodeId": "<节点id>", "text": "改后的文本" },
        { "op": "delete_node", "nodeId": "<节点id>" }
      ]
    }
  }
}
```

约束：单次最多 100 条；根节点不可删除；全部操作按顺序执行，
批准后作为**一个撤销单元**落盘（Ctrl+Z 一次可整体撤销）。

## 注意事项

- token 每次应用启动轮换，重启后需重新复制接入命令
- 应用关闭即停服并删除发现文件；未优雅退出时残留文件中的 `pid` 可用于活性判断
- Web 端无 MCP 能力（浏览器无法监听本地端口）
