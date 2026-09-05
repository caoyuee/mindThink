/**
 * 树结构定义
 *
 * 设计原则：与 markmap 解耦。markmap 内部用 { content, children } 结构，
 * 我们在 store 中维护稳定的 { id, text, ... } 树，渲染时转换为 markmap 格式。
 */

let _idCounter = 0;
function genId(prefix = 'n'): string {
  _idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_idCounter}`;
}

/** 节点 */
export interface MindNode {
  /** 稳定 ID，用于命令栈定位、撤销/重做 */
  id: string;
  /** 显示文本（Markdown 一级渲染） */
  text: string;
  /** 备注（Markdown 多行） */
  note?: string;
  /** 子节点 */
  children: MindNode[];
  /** 自定义元数据（颜色、图标、超链接等） */
  meta?: Record<string, unknown>;
}

/** 树根 */
export interface MindDoc {
  root: MindNode;
  meta?: Record<string, unknown>;
}

/** 创建节点（默认带 ID） */
export function createNode(text: string, partial: Partial<MindNode> = {}): MindNode {
  return {
    id: genId(),
    text,
    children: [],
    ...partial,
  };
}

/** 深拷贝树（避免命令栈和原树互相影响） */
export function cloneTree(node: MindNode): MindNode {
  return {
    id: node.id,
    text: node.text,
    note: node.note,
    meta: node.meta ? { ...node.meta } : undefined,
    children: node.children.map(cloneTree),
  };
}

/** 在树里按 ID 查找（返回引用），未找到返回 null */
export function findNode(root: MindNode, id: string): MindNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

/** 获取父节点（root 没有） */
export function findParent(root: MindNode, id: string): MindNode | null {
  for (const child of root.children) {
    if (child.id === id) return root;
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}

/** 节点所在路径（从根到目标） */
export function findPath(root: MindNode, id: string): MindNode[] | null {
  if (root.id === id) return [root];
  for (const child of root.children) {
    const path = findPath(child, id);
    if (path) {
      return [root, ...path];
    }
  }
  return null;
}

/** 将树序列化为 Markdown（markmap 兼容） */
export function toMarkdown(root: MindNode, depth = 0): string {
  const indent = '  '.repeat(depth);
  let out = `${indent}- ${root.text}\n`;
  if (root.note) {
    // 把备注放在代码块里附在该节点后
    out += `${indent}  \n${indent}  > ${root.note.replace(/\n/g, `\n${indent}  > `)}\n`;
  }
  for (const child of root.children) {
    out += toMarkdown(child, depth + 1);
  }
  return out;
}

/**
 * 将 Markdown 解析为树。
 * 简化版：仅识别 "- text" 列表，缩进决定层级。
 * 对于 markmap 完整 Markdown（包括 **bold**、# 标题、代码块等），交给 markmap-lib。
 *
 * 根节点: 第一个 0 缩进的 "- text" 行的 text; 若不存在, 默认 "中心主题"。
 */
export function fromMarkdown(md: string): MindNode {
  const lines = md.split(/\r?\n/);
  const rootStack: { node: MindNode; indent: number }[] = [];

  // 找第一个 0 缩进的项作为根文本
  let rootText = '中心主题';
  for (const line of lines) {
    const m = line.match(/^-(\s*)-?\s+(.*)$/);
    if (m && m[1].length === 0) {
      rootText = m[2].trim();
      break;
    }
    // 也支持直接 "- root text" (没有前导空格)
    const m2 = line.match(/^-\s+(.*)$/);
    if (m2) {
      rootText = m2[1].trim();
      break;
    }
  }

  const root = createNode(rootText);
  rootStack.push({ node: root, indent: -1 });

  for (const line of lines) {
    if (!line.trim()) continue;
    const m = line.match(/^(\s*)-\s+(.*)$/);
    if (!m) continue;
    const indent = m[1].length;
    const text = m[2].trim();
    // 跳过第一行（已经是根节点文本）
    if (indent === 0 && text === rootText && rootStack.length === 1) continue;
    const node = createNode(text);

    // 找到缩进刚好 ≤ 当前行的栈项作为父
    while (rootStack.length > 1 && rootStack[rootStack.length - 1].indent >= indent) {
      rootStack.pop();
    }
    const parent = rootStack[rootStack.length - 1].node;
    parent.children.push(node);
    rootStack.push({ node, indent });
  }
  return root;
}

/** 按文本搜索节点，忽略大小写并返回从根到节点的路径。 */
export function searchNodes(root: MindNode, query: string): MindNode[][] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const results: MindNode[][] = [];
  function visit(node: MindNode, path: MindNode[]): void {
    const nextPath = [...path, node];
    if (node.text.toLocaleLowerCase().includes(normalized)) results.push(nextPath);
    for (const child of node.children) visit(child, nextPath);
  }
  visit(root, []);
  return results;
}

/** 统计节点总数 */
export function countNodes(root: MindNode): number {
  let n = 1;
  for (const c of root.children) n += countNodes(c);
  return n;
}

/** 随机生成用于性能测试的大树 */
export function generateLargeTree(branching = 4, depth = 5): MindNode {
  const root = createNode('中心主题');
  function expand(parent: MindNode, d: number) {
    if (d <= 0) return;
    for (let i = 0; i < branching; i++) {
      const c = createNode(`${parent.text} - 子 ${i + 1}`);
      parent.children.push(c);
      expand(c, d - 1);
    }
  }
  expand(root, depth);
  return root;
}
