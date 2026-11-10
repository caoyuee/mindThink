/**
 * MCP Server 协议层（D5 阶段一：Server 实时桥接）。
 *
 * 职责：把一条 MCP JSON-RPC 请求分发为响应。读链路复用 `handleMcpRpcRequest`
 * + 实时 `McpContext`（不落快照）；写链路 `tools/call: apply_ops` 交给宿主
 * `deps.applyOps` —— 批准门控（fail-closed）由桌面 webview 实现，本层不落盘。
 *
 * 传输无关：纯函数、零 Vue 依赖，供桌面 webview 桥接层与单元测试复用。
 */
import {
  handleMcpRpcRequest,
  MCP_TOOL_DESCRIPTORS,
  type McpContext,
  type McpRpcRequest,
  type McpRpcResponse,
} from './mcp';
import { parseMindMapOps, type MindMapOp, type OpResult } from './ops';

// 工具面定义在 mcp.ts（与 tools/list 同源），此处 re-export 供宿主/测试引用。
export { MCP_TOOL_DESCRIPTORS };

/** apply_ops 的宿主执行结果：批准与否 + 每条 op 的结果。 */
export interface ApplyOpsOutcome {
  approved: boolean;
  /** 拒绝原因（未批准时）。 */
  reason?: string;
  /** 每条 op 的执行结果（已批准时）。 */
  results?: OpResult[];
  appliedCount?: number;
}

export interface McpServerDeps {
  /** 取当前文档的实时 MCP 上下文（读链路，不落快照）。 */
  getContext(): McpContext;
  /**
   * 应用外部写 ops。宿主负责：批准门控（默认 fail-closed）→ 调用方文档命令栈
   * （一次调用 = 一个撤销单元）。拒绝或失败时 approved=false 并给出原因。
   */
  applyOps(ops: MindMapOp[]): Promise<ApplyOpsOutcome> | ApplyOpsOutcome;
  /** 导出当前文档 Markdown（复用桌面端既有导出链路）。 */
  exportMarkdown(): Promise<string> | string;
}

function textResult(text: string, isError = false): McpRpcResponse {
  const result: Record<string, unknown> = { content: [{ type: 'text', text }] };
  if (isError) result['isError'] = true;
  return { jsonrpc: '2.0', id: null, result };
}

function withId(response: McpRpcResponse, id: string | number | null): McpRpcResponse {
  return { ...response, id };
}

function jsonResult(value: unknown): McpRpcResponse {
  return textResult(JSON.stringify(value));
}

function errorResult(message: string): McpRpcResponse {
  return textResult(JSON.stringify({ error: message }), true);
}

async function handleToolsCall(
  id: string | number | null,
  name: unknown,
  args: Record<string, unknown> | undefined,
  deps: McpServerDeps,
): Promise<McpRpcResponse> {
  if (typeof name !== 'string') return withId(errorResult('tools/call 缺少 name'), id);
  const context = deps.getContext();
  switch (name) {
    case 'query_tree': {
      return withId(
        jsonResult({
          title: context.current.title,
          nodeCount: context.current.nodeCount,
          markdown: context.current.markdown,
        }),
        id,
      );
    }
    case 'get_node': {
      const nodeId = args?.['nodeId'];
      if (typeof nodeId !== 'string') return withId(errorResult('缺少 nodeId'), id);
      const node = context.nodes[nodeId];
      if (!node) return withId(errorResult(`节点不存在: ${nodeId}`), id);
      return withId(jsonResult(node), id);
    }
    case 'search_nodes': {
      const query = args?.['query'];
      if (typeof query !== 'string' || !query.trim())
        return withId(errorResult('缺少 query'), id);
      const needle = query.trim().toLowerCase();
      const hits = Object.values(context.nodes)
        .filter(
          (node) =>
            node.text.toLowerCase().includes(needle) ||
            (node.note?.toLowerCase().includes(needle) ?? false),
        )
        .slice(0, 50)
        .map((node) => ({ id: node.id, text: node.text, note: node.note, childIds: node.childIds }));
      return withId(jsonResult({ total: hits.length, hits }), id);
    }
    case 'export_markdown': {
      return withId(jsonResult({ markdown: await deps.exportMarkdown() }), id);
    }
    case 'apply_ops': {
      const parsed = parseMindMapOps(args?.['ops']);
      if (typeof parsed === 'string') return withId(errorResult(parsed), id);
      const outcome = await deps.applyOps(parsed);
      if (!outcome.approved) {
        return withId(
          errorResult(JSON.stringify({ approved: false, reason: outcome.reason ?? '用户未批准' })),
          id,
        );
      }
      return withId(
        jsonResult({
          approved: true,
          appliedCount: outcome.appliedCount ?? 0,
          results: outcome.results ?? [],
        }),
        id,
      );
    }
    default:
      return withId(errorResult(`未知工具: ${name}`), id);
  }
}

/**
 * 处理一条 MCP JSON-RPC 请求。
 * 返回 null 表示无需响应（JSON-RPC notification，如 notifications/initialized），
 * 由传输层按协议返回 202。
 */
export async function handleMcpServerRpc(
  request: McpRpcRequest,
  deps: McpServerDeps,
): Promise<McpRpcResponse | null> {
  const id = request.id ?? null;
  // JSON-RPC notification：无 id，不回响应。
  if (request.id === undefined) return null;
  if (request.method === 'ping') return { jsonrpc: '2.0', id, result: {} };
  if (request.method === 'tools/call') {
    const params = request.params ?? {};
    try {
      return await handleToolsCall(id, params['name'], params['arguments'] as never, deps);
    } catch (error) {
      return withId(errorResult((error as Error).message), id);
    }
  }
  // 其余方法（initialize / tools/list / resources/*）交给共享分发器。
  return handleMcpRpcRequest(request, deps.getContext());
}
