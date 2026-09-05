import { describe, expect, it } from 'vitest';
import { createAiChatRequest, normalizeAiEndpoint, readAiChatResponse } from '@/core/ai';
import {
  createMcpContext,
  decodeMcpMessage,
  encodeMcpMessage,
  handleMcpRpcRequest,
  processMcpMessage,
} from '@/core/mcp';
import { createNode } from '@/core/tree';

describe('core/ai', () => {
  it('validates endpoints and includes mindmap context', () => {
    expect(normalizeAiEndpoint('https://example.com/v1/')).toBe('https://example.com/v1');
    expect(normalizeAiEndpoint('file:///secret')).toBeNull();
    const request = createAiChatRequest(
      'test-model',
      'Organize this',
      createMcpContext({ root: createNode('Root') }),
    );
    expect(request.messages[1]?.content).toContain('- Root');
  });

  it('reads a standard chat completion response', () => {
    expect(readAiChatResponse({ choices: [{ message: { content: 'Suggestion' } }] })).toBe(
      'Suggestion',
    );
    expect(() => readAiChatResponse({ choices: [] })).toThrow('AI 返回内容为空');
  });

  it('serves MCP resources through JSON-RPC', () => {
    const context = createMcpContext({ root: createNode('Root') });
    const response = handleMcpRpcRequest(
      { jsonrpc: '2.0', id: 1, method: 'resources/read', params: { uri: 'mindmap://current' } },
      context,
    );
    expect(response.result?.contents).toBeDefined();
    expect(
      handleMcpRpcRequest({ jsonrpc: '2.0', id: 2, method: 'unknown' }, context).error?.code,
    ).toBe(-32601);
    expect(JSON.parse(processMcpMessage('{bad', context)).error.code).toBe(-32700);
    const line = encodeMcpMessage({ jsonrpc: '2.0', id: 3, method: 'initialize' });
    expect(decodeMcpMessage(line)).toMatchObject({ method: 'initialize' });
    expect(() => decodeMcpMessage(`${line}\n`)).toThrow('单行');
  });
});
