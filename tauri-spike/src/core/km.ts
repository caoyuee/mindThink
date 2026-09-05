/**
 * KityMinder .km 导入器。
 * 只负责把旧版 JSON 树转换成当前 MindNode，不依赖 Vue 或 Tauri。
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
