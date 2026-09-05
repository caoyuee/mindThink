/** KityMinder .km JSON importer. */
import { createNode, type MindNode } from './tree';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nodeText(data: JsonObject): string {
  return typeof data['text'] === 'string' && data['text'].trim() ? data['text'] : '中心主题';
}

function convert(value: unknown): MindNode {
  if (!isObject(value)) throw new Error('KM 节点格式无效');
  const data = isObject(value['data']) ? value['data'] : value;
  const node = createNode(nodeText(data), {
    note: typeof data['note'] === 'string' ? data['note'] : undefined,
    meta: { ...data },
  });
  const children = Array.isArray(value['children'])
    ? value['children']
    : Array.isArray(data['children'])
      ? data['children']
      : [];
  node.children = children.map(convert);
  return node;
}

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
  return convert(parsed['root']);
}
