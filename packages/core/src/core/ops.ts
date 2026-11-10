/**
 * MindMapOp —— 内置 AI（D4 L2）与 MCP 外部写入（D5）共用的结构化操作 schema。
 *
 * 全部为纯数据（可序列化、不持闭包），满足红线 1.1.3；应用层经命令栈落地，
 * 一次批量应用 = 一个撤销单元（D4/D5「一个 AI 建议 = 一个可撤销单元」）。
 * 校验与应用均为纯函数，零 Vue 依赖，可独立测试。
 */
import { cloneTree, findNode, findParent, type MindDoc, type MindNode } from './tree';

export type MindMapOp =
  | { op: 'add_child'; parentId: string; text: string; note?: string }
  | { op: 'add_sibling'; siblingId: string; text: string; note?: string }
  | { op: 'update_node'; nodeId: string; text?: string; note?: string | null }
  | { op: 'delete_node'; nodeId: string };

export type OpResult = { ok: true; nodeId?: string } | { ok: false; error: string };

export interface OpsApplyResult {
  /** 应用成功 op 之后的新文档（即使部分失败，成功的 op 已生效）。 */
  doc: MindDoc;
  results: OpResult[];
  appliedCount: number;
}

/** 单次 apply_ops 允许的最大操作数（防御外部 Agent 失控写入）。 */
export const MAX_OPS_PER_CALL = 100;

const OP_KINDS = new Set(['add_child', 'add_sibling', 'update_node', 'delete_node']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 校验外部传入的 ops 数组。通过返回解析后的 ops，否则返回可读错误说明。
 * 只做结构与取值校验，不做树存在性检查（那需要文档，留给 applyOpsToDoc）。
 */
export function parseMindMapOps(value: unknown): MindMapOp[] | string {
  if (!Array.isArray(value)) return 'ops 必须是数组';
  if (value.length === 0) return 'ops 不能为空';
  if (value.length > MAX_OPS_PER_CALL) return `单次最多 ${MAX_OPS_PER_CALL} 条操作`;
  const ops: MindMapOp[] = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) return `ops[${index}] 必须是对象`;
    const kind = item['op'];
    if (typeof kind !== 'string' || !OP_KINDS.has(kind)) return `ops[${index}].op 无效`;
    switch (kind) {
      case 'add_child':
      case 'add_sibling': {
        const target = kind === 'add_child' ? 'parentId' : 'siblingId';
        if (!validText(item[target])) return `ops[${index}].${target} 必须是非空字符串`;
        if (!validText(item['text'])) return `ops[${index}].text 必须是非空字符串`;
        if (item['note'] !== undefined && typeof item['note'] !== 'string')
          return `ops[${index}].note 必须是字符串`;
        const op = { op: kind, text: item['text'] as string } as Record<string, unknown>;
        op[target] = item[target];
        if (item['note'] !== undefined) op['note'] = item['note'];
        ops.push(op as unknown as MindMapOp);
        break;
      }
      case 'update_node': {
        if (!validText(item['nodeId'])) return `ops[${index}].nodeId 必须是非空字符串`;
        const hasText = item['text'] !== undefined;
        const hasNote = item['note'] !== undefined;
        if (!hasText && !hasNote) return `ops[${index}] 至少提供 text 或 note`;
        if (hasText && !validText(item['text'])) return `ops[${index}].text 必须是非空字符串`;
        if (hasNote && item['note'] !== null && typeof item['note'] !== 'string')
          return `ops[${index}].note 必须是字符串或 null`;
        const op: Record<string, unknown> = { op: kind, nodeId: item['nodeId'] };
        if (hasText) op['text'] = item['text'];
        if (hasNote) op['note'] = item['note'];
        ops.push(op as unknown as MindMapOp);
        break;
      }
      case 'delete_node': {
        if (!validText(item['nodeId'])) return `ops[${index}].nodeId 必须是非空字符串`;
        ops.push({ op: 'delete_node', nodeId: item['nodeId'] });
        break;
      }
    }
  }
  return ops;
}

function insertChild(
  parent: MindNode,
  text: string,
  note: string | undefined,
  newId: () => string,
): MindNode {
  const node: MindNode = { id: newId(), text, children: [] };
  if (note !== undefined) node.note = note;
  parent.children.push(node);
  return node;
}

/**
 * 把已校验的 ops 应用到文档（纯函数，不触碰命令栈）。
 * 顺序执行：前面的 op 生效后的树作为后续 op 的执行环境。
 * 根节点不可删除（root 唯一性由调用方文档结构保证）。
 */
export function applyOpsToDoc(doc: MindDoc, ops: MindMapOp[], newId: () => string): OpsApplyResult {
  const next = { root: cloneTree(doc.root), meta: doc.meta ? { ...doc.meta } : undefined };
  const results: OpResult[] = [];
  for (const op of ops) {
    switch (op.op) {
      case 'add_child': {
        const parent = findNode(next.root, op.parentId);
        if (!parent) {
          results.push({ ok: false, error: `父节点不存在: ${op.parentId}` });
          break;
        }
        const created = insertChild(parent, op.text, op.note, newId);
        results.push({ ok: true, nodeId: created.id });
        break;
      }
      case 'add_sibling': {
        const sibling = findNode(next.root, op.siblingId);
        if (!sibling) {
          results.push({ ok: false, error: `参照节点不存在: ${op.siblingId}` });
          break;
        }
        const parent = findParent(next.root, op.siblingId);
        if (!parent) {
          results.push({ ok: false, error: '不能在根节点旁插入兄弟节点' });
          break;
        }
        const node: MindNode = { id: newId(), text: op.text, children: [] };
        if (op.note !== undefined) node.note = op.note;
        const at = parent.children.indexOf(sibling);
        parent.children.splice(at + 1, 0, node);
        results.push({ ok: true, nodeId: node.id });
        break;
      }
      case 'update_node': {
        const node = findNode(next.root, op.nodeId);
        if (!node) {
          results.push({ ok: false, error: `节点不存在: ${op.nodeId}` });
          break;
        }
        if (op.text !== undefined) node.text = op.text;
        if (op.note !== undefined) {
          if (op.note === null) delete node.note;
          else node.note = op.note;
        }
        results.push({ ok: true, nodeId: node.id });
        break;
      }
      case 'delete_node': {
        const node = findNode(next.root, op.nodeId);
        if (!node) {
          results.push({ ok: false, error: `节点不存在: ${op.nodeId}` });
          break;
        }
        const parent = findParent(next.root, op.nodeId);
        if (!parent) {
          results.push({ ok: false, error: '根节点不可删除' });
          break;
        }
        parent.children.splice(parent.children.indexOf(node), 1);
        results.push({ ok: true });
        break;
      }
    }
  }
  return {
    doc: next,
    results,
    appliedCount: results.filter((r) => r.ok).length,
  };
}
