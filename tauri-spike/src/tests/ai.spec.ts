import { describe, expect, it } from 'vitest';
import { createAiChatRequest, normalizeAiEndpoint, readAiChatResponse } from '@/core/ai';
import { createNode } from '@/core/tree';
import {
  createMcpContext,
  decodeMcpMessage,
  encodeMcpMessage,
  processMcpMessage,
  handleMcpRpcRequest,
  parseMcpRpcRequest,
} from '@/core/mcp';

describe('core/mcp transport messages', () => {
  it('round-trips a single-line JSON RPC request', () => {
    const message = { jsonrpc: '2.0' as const, id: 1, method: 'tools/list' };
    expect(decodeMcpMessage(encodeMcpMessage(message).trim())).toEqual(message);
    expect(() => decodeMcpMessage('{"jsonrpc":"2.0",\n"method":"tools/list"}')).toThrow('单行');
    const error = processMcpMessage('{bad', createMcpContext({ root: createNode('Root') }));
    expect(JSON.parse(error).error.code).toBe(-32700);
  });
});

describe('core/mcp rpc', () => {
  it('lists tools and reads the current resource', () => {
    const context = createMcpContext({ root: createNode('Root') });
    const request = parseMcpRpcRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const response = handleMcpRpcRequest(request, context);
    expect(response.result?.['tools']).toHaveLength(3);
    const resource = handleMcpRpcRequest(
      parseMcpRpcRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/read',
        params: { uri: 'mindmap://current' },
      }),
      context,
    );
    expect(JSON.stringify(resource.result)).toContain('- Root');
    const nodeContext = createMcpContext({ root: createNode('Node') });
    const childId = Object.keys(nodeContext.nodes)[0];
    const nodeResource = handleMcpRpcRequest(
      parseMcpRpcRequest({
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/read',
        params: { uri: `mindmap://node/${childId}` },
      }),
      nodeContext,
    );
    expect(nodeResource.result?.['contents']).toBeDefined();
    const unknown = handleMcpRpcRequest(
      parseMcpRpcRequest({ jsonrpc: '2.0', id: 4, method: 'unknown/method' }),
      nodeContext,
    );
    expect(unknown.error?.code).toBe(-32601);
  });

  it('turns tools/call into an internal request payload', () => {
    const context = createMcpContext({ root: createNode('Root') });
    const response = handleMcpRpcRequest(
      parseMcpRpcRequest({
        jsonrpc: '2.0',
        id: 'x',
        method: 'tools/call',
        params: { name: 'update_node', arguments: { id: 'n', text: 'New' } },
      }),
      context,
    );
    expect(JSON.stringify(response.result)).toContain('update_node');
  });
});

describe('core/ai', () => {
  it('accepts only HTTP(S) endpoints', () => {
    expect(normalizeAiEndpoint('https://example.com/v1/')).toBe('https://example.com/v1');
    expect(normalizeAiEndpoint('file:///secret')).toBeNull();
  });

  it('includes the current mindmap in the chat request', () => {
    const context = createMcpContext({ root: createNode('Root') });
    const request = createAiChatRequest('test-model', 'Organize this', context);
    expect(request.model).toBe('test-model');
    expect(request.messages[1]?.content).toContain('- Root');
  });

  it('reads a standard chat completion response', () => {
    expect(readAiChatResponse({ choices: [{ message: { content: 'Suggestion' } }] })).toBe(
      'Suggestion',
    );
    expect(() => readAiChatResponse({ choices: [] })).toThrow('AI 返回内容为空');
  });
});
