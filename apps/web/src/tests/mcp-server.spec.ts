import { describe, expect, it } from 'vitest';
import { createMcpContext } from '@/core/mcp';
import { handleMcpServerRpc, type McpServerDeps } from '@/core/mcp-server';
import { createNode, type MindNode } from '@/core/tree';

function tree(): MindNode {
  return createNode('Root', {
    children: [createNode('A', { children: [createNode('A1')] }), createNode('B')],
  });
}

// 固定单一 context：节点 id 由 createNode 生成，跨调用必须一致。
const fixedContext = createMcpContext({ root: tree() });

function deps(over: Partial<McpServerDeps> = {}): McpServerDeps {
  return {
    getContext: () => fixedContext,
    applyOps: () => ({ approved: false, reason: '未接通' }),
    exportMarkdown: () => '# root',
    ...over,
  };
}

function firstText(response: { result?: Record<string, unknown> } | null): string {
  const content = response?.result?.content as Array<{ text: string }> | undefined;
  return content?.[0]?.text ?? '{}';
}

describe('handleMcpServerRpc', () => {
  it('returns null for notifications (no id)', async () => {
    expect(
      await handleMcpServerRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, deps()),
    ).toBeNull();
  });

  it('answers ping and initialize', async () => {
    const ping = await handleMcpServerRpc({ jsonrpc: '2.0', id: 1, method: 'ping' }, deps());
    expect(ping).toMatchObject({ result: {} });
    const init = await handleMcpServerRpc(
      { jsonrpc: '2.0', id: 2, method: 'initialize', params: {} },
      deps(),
    );
    expect(init?.result?.serverInfo).toMatchObject({ name: 'mindThink' });
  });

  it('lists the new tool surface', async () => {
    const response = await handleMcpServerRpc(
      { jsonrpc: '2.0', id: 3, method: 'tools/list' },
      deps(),
    );
    const names = (response?.result?.tools as Array<{ name: string }>).map((tool) => tool.name);
    expect(names).toEqual([
      'query_tree',
      'get_node',
      'search_nodes',
      'export_markdown',
      'apply_ops',
    ]);
  });

  it('serves query_tree / get_node / search_nodes read tools', async () => {
    const q = await handleMcpServerRpc(
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'query_tree', arguments: {} } },
      deps(),
    );
    const payload = JSON.parse(firstText(q));
    expect(payload.title).toBe('Root');
    expect(payload.nodeCount).toBe(4);
    expect(payload.markdown).toContain('- A1');

    const nodeId = Object.keys(fixedContext.nodes).find((id) => fixedContext.nodes[id]?.text === 'A') ?? '';
    const g = await handleMcpServerRpc(
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'get_node', arguments: { nodeId } },
      },
      deps(),
    );
    expect(JSON.parse(firstText(g)).text).toBe('A');

    const s = await handleMcpServerRpc(
      {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: { name: 'search_nodes', arguments: { query: 'a1' } },
      },
      deps(),
    );
    expect(JSON.parse(firstText(s)).hits).toHaveLength(1);

    const miss = await handleMcpServerRpc(
      {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'get_node', arguments: { nodeId: 'nope' } },
      },
      deps(),
    );
    expect(miss?.result?.isError).toBe(true);
  });

  it('export_markdown uses host export path', async () => {
    const response = await handleMcpServerRpc(
      {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: { name: 'export_markdown', arguments: {} },
      },
      deps({ exportMarkdown: () => '# exported' }),
    );
    expect(JSON.parse(firstText(response)).markdown).toBe('# exported');
  });

  it('apply_ops is fail-closed when host rejects', async () => {
    const response = await handleMcpServerRpc(
      {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'apply_ops',
          arguments: { ops: [{ op: 'add_child', parentId: 'root', text: 'X' }] },
        },
      },
      deps({ applyOps: () => ({ approved: false, reason: '用户拒绝' }) }),
    );
    expect(response?.result?.isError).toBe(true);
    expect(firstText(response)).toContain('用户拒绝');
  });

  it('apply_ops returns per-op results when approved', async () => {
    const applied: unknown[][] = [];
    const response = await handleMcpServerRpc(
      {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'apply_ops',
          arguments: {
            ops: [
              { op: 'add_child', parentId: 'root', text: 'X' },
              { op: 'delete_node', nodeId: 'missing' },
            ],
          },
        },
      },
      deps({
        applyOps: (ops) => {
          applied.push(ops);
          return {
            approved: true,
            appliedCount: 1,
            results: [
              { ok: true, nodeId: 'new_1' },
              { ok: false, error: '节点不存在: missing' },
            ],
          };
        },
      }),
    );
    const payload = JSON.parse(firstText(response));
    expect(payload.approved).toBe(true);
    expect(payload.appliedCount).toBe(1);
    expect(payload.results).toHaveLength(2);
    expect(applied[0]).toHaveLength(2);
  });
});
