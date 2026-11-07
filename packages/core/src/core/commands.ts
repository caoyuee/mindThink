/**
 * 命令模式：撤销/重做栈
 *
 * 每个命令记录"修改前的状态"与"修改后的状态"。
 * 执行：do() 切换到新状态；undo() 切换回旧状态。
 * 完整树快照（diff 留给后续阶段优化，spike 阶段先用简单方案验证可行性）。
 */

import type { MindDoc, MindNode } from './tree';
import { cloneTree } from './tree';

export interface Command {
  /** 唯一标识，便于调试 */
  readonly name: string;
  /** 时间戳，便于按时间清理 */
  readonly timestamp: number;
  /** 执行（首次执行或重做） */
  redo(): MindDoc;
  /** 撤销 */
  undo(): MindDoc;
}

/** 创建命令的工厂：传入 before/after 两棵树 */
export function makeSnapshotCommand(name: string, before: MindDoc, after: MindDoc): Command {
  return {
    name,
    timestamp: Date.now(),
    redo: () => cloneDoc(after),
    undo: () => cloneDoc(before),
  };
}

function cloneDoc(doc: MindDoc): MindDoc {
  return {
    root: cloneTree(doc.root),
    meta: doc.meta ? { ...doc.meta } : undefined,
  };
}

/** 命令栈管理器 */
export class CommandStack {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  /** 最大历史长度，避免内存膨胀 */
  public maxHistory = 100;

  constructor(
    private getDoc: () => MindDoc,
    private setDoc: (d: MindDoc) => void,
  ) {}

  /** 执行命令（命令对象已包含 before/after） */
  execute(cmd: Command): void {
    const next = cmd.redo();
    this.setDoc(next);
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.redoStack = [];
  }

  /** 推入并执行快照式命令 */
  executeWith(before: MindDoc, after: MindDoc, name: string): void {
    this.execute(makeSnapshotCommand(name, before, after));
  }

  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    this.setDoc(cmd.undo());
    this.redoStack.push(cmd);
    return true;
  }

  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    this.setDoc(cmd.redo());
    this.undoStack.push(cmd);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /** 当前快照名（用于 UI 显示上一操作是什么） */
  peekUndoName(): string {
    const cmd = this.undoStack[this.undoStack.length - 1];
    return cmd ? cmd.name : '';
  }
  peekRedoName(): string {
    const cmd = this.redoStack[this.redoStack.length - 1];
    return cmd ? cmd.name : '';
  }
}

/** 辅助：从根节点构造文档（简化常见用法） */
export function docOf(root: MindNode, m?: Record<string, unknown>): MindDoc {
  return { root, meta: m };
}
