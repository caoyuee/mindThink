/**
 * KityMinder .km 导入/导出器。
 * 只负责旧版 JSON 树与当前 MindNode 的双向转换，不依赖 Vue 或 Tauri。
 */
import { createNode, type MindNode } from './tree';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textOf(data: JsonObject): string {
  const text = data['text'];
  if (typeof text === 'string' && text.trim()) return text;
  return '中心主题';
}

function childrenOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function convertNode(value: unknown, isRoot = false): MindNode {
  if (!isObject(value)) throw new Error('KM 节点格式无效');
  const data = isObject(value['data']) ? value['data'] : value;
  const node = createNode(textOf(data), {
    note: typeof data['note'] === 'string' ? data['note'] : undefined,
    meta: { ...data },
  });
  const children = childrenOf(value['children'] ?? data['children']);
  node.children = children.map((child) => convertNode(child));
  if (isRoot && node.text === '中心主题' && children.length === 0) {
    throw new Error('KM 文件没有有效的根节点');
  }
  return node;
}

/** 将 KityMinder JSON 文本转换为 MindNode。 */
export function fromKmJson(input: string): MindNode {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch (error) {
    throw new Error(`KM 文件不是有效 JSON: ${(error as Error).message}`);
  }
  if (!isObject(parsed) || !isObject(parsed['root'])) {
    throw new Error('KM 文件缺少 root 节点');
  }
  return convertNode(parsed['root'], true);
}

/** 单个 MindNode -> KityMinder 节点 JSON（{data, children?}）。 */
function kmNodeOf(node: MindNode): JsonObject {
  const data: JsonObject = { ...node.meta };
  // 以当前模型为准覆盖 text/note（meta 中可能保留旧值）。
  data['text'] = node.text;
  if (node.note) data['note'] = node.note;
  else delete data['note'];
  const out: JsonObject = { data };
  if (node.children.length > 0) {
    out['children'] = node.children.map(kmNodeOf);
  }
  return out;
}

/**
 * 将 MindNode 导出为 KityMinder .km 的 JSON 文本。
 * 默认模板/主题与 legacy 一致（filetree / fresh-blue），meta 中的扩展字段会保留。
 */
export function toKmJson(root: MindNode): string {
  const doc = {
    root: kmNodeOf(root),
    template: 'filetree',
    theme: 'fresh-blue',
  };
  return JSON.stringify(doc, null, 2);
}
