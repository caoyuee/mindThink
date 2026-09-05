/**
 * markmap 类型简化封装
 *
 * markmap-common / markmap-view 0.18 的类型嵌套较深，且分散在不同子包，
 * 我们这里只用到最小子集，直接独立类型减少耦合，便于将来换库。
 */

export interface MarkmapNode {
  /** 显示内容（HTML / 纯文本） */
  content: string;
  /** 子节点 */
  children: MarkmapNode[];
  /** 自定义负载（存放 id、note 等元数据） */
  payload?: {
    id?: string;
    note?: string;
    fold?: number;
    [key: string]: unknown;
  };
}

/** 兼容旧名称（IPureNode） */
export type IPureNode = MarkmapNode;
