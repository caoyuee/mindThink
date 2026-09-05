import { describe, it, expect, beforeEach } from 'vitest';
import { CommandStack, docOf } from '@/core/commands';
import { type MindDoc, createNode } from '@/core/tree';

describe('core/commands (CommandStack)', () => {
  let stack: CommandStack;
  let doc: MindDoc;
  const setters: MindDoc[] = [];

  beforeEach(() => {
    doc = docOf(createNode('root'));
    setters.length = 0;
    stack = new CommandStack(
      () => doc,
      (d) => {
        setters.push(d);
        doc = d;
      },
    );
  });

  it('starts empty (no undo/redo)', () => {
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
  });

  it('executes commands and populates undo stack', () => {
    stack.executeWith(doc, { root: { ...doc.root, text: 'changed' }, meta: doc.meta }, 'test');
    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(false);
    expect(doc.root.text).toBe('changed');
  });

  it('undo restores previous state', () => {
    stack.executeWith(doc, { root: { ...doc.root, text: 'a' }, meta: doc.meta }, 'cmd1');
    const after1 = doc;
    stack.executeWith(doc, { root: { ...doc.root, text: 'b' }, meta: doc.meta }, 'cmd2');
    expect(doc.root.text).toBe('b');

    stack.undo();
    expect(doc.root.text).toBe('a');
    expect(stack.canRedo()).toBe(true);

    stack.undo();
    expect(doc.root.text).toBe('root');
    expect(stack.canUndo()).toBe(false);
    // consume the unused var warning
    void after1;
  });

  it('redo reapplies the undone state', () => {
    stack.executeWith(doc, { root: { ...doc.root, text: 'a' }, meta: doc.meta }, 'cmd1');
    stack.executeWith(doc, { root: { ...doc.root, text: 'b' }, meta: doc.meta }, 'cmd2');
    stack.undo();
    stack.undo();

    stack.redo();
    expect(doc.root.text).toBe('a');
    stack.redo();
    expect(doc.root.text).toBe('b');
  });

  it('new command clears redo stack', () => {
    stack.executeWith(doc, { root: { ...doc.root, text: 'a' }, meta: doc.meta }, 'cmd1');
    stack.undo();
    expect(stack.canRedo()).toBe(true);

    stack.executeWith(doc, { root: { ...doc.root, text: 'b' }, meta: doc.meta }, 'cmd2');
    expect(stack.canRedo()).toBe(false);
  });

  it('respects maxHistory', () => {
    stack.maxHistory = 3;
    for (let i = 0; i < 5; i++) {
      stack.executeWith(doc, { root: { ...doc.root, text: `v${i}` }, meta: doc.meta }, `cmd${i}`);
    }
    // 只保留 3 条历史
    let count = 0;
    while (stack.undo()) count++;
    expect(count).toBe(3);
  });

  it('peekUndoName shows last command name', () => {
    expect(stack.peekUndoName()).toBe('');
    stack.executeWith(doc, { root: { ...doc.root, text: 'a' }, meta: doc.meta }, 'first-op');
    expect(stack.peekUndoName()).toBe('first-op');
  });

  it('clear empties both stacks', () => {
    stack.executeWith(doc, { root: { ...doc.root, text: 'a' }, meta: doc.meta }, 'cmd1');
    stack.undo();
    expect(stack.canRedo()).toBe(true);
    stack.clear();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
  });

  it('undo returns false when nothing to undo', () => {
    expect(stack.undo()).toBe(false);
  });

  it('redo returns false when nothing to redo', () => {
    expect(stack.redo()).toBe(false);
  });
});
