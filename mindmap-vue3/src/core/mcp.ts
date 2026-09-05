/** Pure MCP context and JSON-RPC helpers. */
import type { MindDoc, MindNode } from './tree';

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
export interface McpResourceDescriptor {
  uri: string;
  name: string;
  mimeType: string;
}
export interface McpRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}
export interface McpRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}
export interface McpContext {
  resources: McpResourceDescriptor[];
  tools: McpToolDescriptor[];
  current: { title: string; markdown: string; nodeCount: number };
  nodes: Record<string, { id: string; text: string; note?: string; childIds: string[] }>;
}

function countNodes(node: MindNode): number {
  return 1 + node.children.reduce((total, child) => total + countNodes(child), 0);
}
function markdown(node: MindNode, depth = 0): string {
  const indent = '  '.repeat(depth);
  const note = node.note ? `\n${indent}  > ${node.note.replace(/\n/g, `\n${indent}  > `)}` : '';
  return `${indent}- ${node.text}${note}\n${node.children.map((child) => markdown(child, depth + 1)).join('')}`;
}

export function createMcpContext(doc: MindDoc): McpContext {
  const nodes: McpContext['nodes'] = {};
  function collect(node: MindNode): void {
    nodes[node.id] = {
      id: node.id,
      text: node.text,
      note: node.note,
      childIds: node.children.map((child) => child.id),
    };
    node.children.forEach(collect);
  }
  collect(doc.root);
  return {
    resources: [
      { uri: 'mindmap://current', name: 'Current mindmap', mimeType: 'text/markdown' },
      { uri: 'mindmap://node/{id}', name: 'Mindmap node', mimeType: 'application/json' },
    ],
    tools: [
      {
        name: 'get_current_mindmap',
        description: 'Read the current mindmap as Markdown.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'update_node',
        description: 'Update a node through the application command stack.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' }, text: { type: 'string' } },
          required: ['id', 'text'],
          additionalProperties: false,
        },
      },
      {
        name: 'add_node',
        description: 'Add a child node through the application command stack.',
        inputSchema: {
          type: 'object',
          properties: { parentId: { type: 'string' }, text: { type: 'string' } },
          required: ['parentId', 'text'],
          additionalProperties: false,
        },
      },
    ],
    current: {
      title: doc.root.text,
      markdown: markdown(doc.root),
      nodeCount: countNodes(doc.root),
    },
    nodes,
  };
}

export function parseMcpRpcRequest(value: unknown): McpRpcRequest {
  if (typeof value !== 'object' || value === null) throw new Error('MCP RPC 请求格式无效');
  const record = value as Record<string, unknown>;
  if (record.jsonrpc !== '2.0' || typeof record.method !== 'string')
    throw new Error('MCP RPC 请求格式无效');
  const id = record.id;
  if (id !== undefined && typeof id !== 'string' && typeof id !== 'number')
    throw new Error('MCP RPC id 必须是字符串或数字');
  const params = record.params;
  if (
    params !== undefined &&
    (typeof params !== 'object' || params === null || Array.isArray(params))
  )
    throw new Error('MCP RPC params 必须是对象');
  return {
    jsonrpc: '2.0',
    id: id as string | number | undefined,
    method: record.method,
    params: params as Record<string, unknown> | undefined,
  };
}

export function encodeMcpMessage(value: McpRpcRequest | McpRpcResponse): string {
  return `${JSON.stringify(value)}\n`;
}
export function decodeMcpMessage(line: string): McpRpcRequest | McpRpcResponse {
  if (line.includes('\n') || line.includes('\r')) throw new Error('MCP 消息必须是单行 JSON');
  let value: unknown;
  try {
    value = JSON.parse(line) as unknown;
  } catch (error) {
    throw new Error(`MCP 消息不是有效 JSON: ${(error as Error).message}`);
  }
  if (typeof value !== 'object' || value === null) throw new Error('MCP 消息必须是对象');
  const record = value as Record<string, unknown>;
  if (record.jsonrpc === '2.0' && typeof record.method === 'string')
    return parseMcpRpcRequest(value);
  if (record.jsonrpc === '2.0' && ('result' in record || 'error' in record))
    return value as McpRpcResponse;
  throw new Error('MCP 消息不是有效 RPC 请求或响应');
}

export function handleMcpRpcRequest(request: McpRpcRequest, context: McpContext): McpRpcResponse {
  const id = request.id ?? null;
  try {
    switch (request.method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'DesktopNaotu', version: '0.1.0' },
            capabilities: { resources: {}, tools: {} },
          },
        };
      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: context.tools } };
      case 'resources/list':
        return { jsonrpc: '2.0', id, result: { resources: context.resources } };
      case 'resources/read': {
        const uri = request.params?.uri;
        if (typeof uri !== 'string') throw new Error('resources/read 缺少 uri');
        if (uri === 'mindmap://current')
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [{ uri, mimeType: 'text/markdown', text: context.current.markdown }],
            },
          };
        const prefix = 'mindmap://node/';
        const node = uri.startsWith(prefix) ? context.nodes[uri.slice(prefix.length)] : undefined;
        if (!node) throw new Error('MCP 节点不存在');
        return {
          jsonrpc: '2.0',
          id,
          result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(node) }] },
        };
      }
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `不支持的 MCP 方法: ${request.method}` },
        };
    }
  } catch (error) {
    return { jsonrpc: '2.0', id, error: { code: -32602, message: (error as Error).message } };
  }
}

export function processMcpMessage(line: string, context: McpContext): string {
  try {
    const request = decodeMcpMessage(line);
    return encodeMcpMessage('method' in request ? handleMcpRpcRequest(request, context) : request);
  } catch (error) {
    return encodeMcpMessage({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: (error as Error).message },
    });
  }
}
