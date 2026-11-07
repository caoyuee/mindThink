/**
 * DialogHost / ConfirmDialog / PromptDialog / useDialog 集成测试
 *
 * DialogHost 把弹窗 Teleport 到 body；测试通过 document 查询 data-testid 交互，
 * 覆盖 A2 规格要求的：confirm true/false、cancel false/null、Esc 触发取消、
 * Prompt 提交返回输入值、Enter 提交。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import DialogHost from '@/components/dialogs/DialogHost.vue';
import { dialogState, settleDialog, useDialog } from '@/composables/useDialog';

let host: VueWrapper | null = null;

function mountHost(): void {
  host = mount(DialogHost);
}

function byTestId(id: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${id}"]`);
}

async function tick(): Promise<void> {
  await flushPromises();
}

afterEach(() => {
  if (dialogState.active) settleDialog(null);
  host?.unmount();
  host = null;
  // 清掉可能残留的 Teleport 节点，避免跨用例互相污染。
  document.querySelectorAll('[data-testid="dialog-backdrop"]').forEach((node) => node.remove());
});

describe('useDialog + DialogHost', () => {
  it('confirm 点确定 resolves true', async () => {
    mountHost();
    const result = useDialog().confirm({ title: '确认', message: '正文' });
    await tick();
    const ok = byTestId('dialog-ok');
    expect(ok).not.toBeNull();
    expect(byTestId('dialog-panel')?.getAttribute('role')).toBe('dialog');
    ok?.click();
    await tick();
    await expect(result).resolves.toBe(true);
  });

  it('confirm 点取消 resolves false', async () => {
    mountHost();
    const result = useDialog().confirm({ title: '确认', message: '正文' });
    await tick();
    byTestId('dialog-cancel')?.click();
    await tick();
    await expect(result).resolves.toBe(false);
  });

  it('confirm 按 Esc resolves false', async () => {
    mountHost();
    const result = useDialog().confirm({ title: '确认', message: '正文' });
    await tick();
    byTestId('dialog-panel')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await tick();
    await expect(result).resolves.toBe(false);
  });

  it('danger 确认弹窗存在且文案正确', async () => {
    mountHost();
    void useDialog().confirm({
      title: '危险操作',
      message: '真的要删除吗？',
      okText: '删除',
      cancelText: '取消',
      danger: true,
    });
    await tick();
    expect(byTestId('dialog-ok')?.textContent).toBe('删除');
    expect(byTestId('dialog-cancel')?.textContent).toBe('取消');
    // 一个请求同一时间只渲染一个弹窗。
    expect(document.querySelectorAll('[data-testid="dialog-panel"]').length).toBe(1);
  });

  it('prompt 提交返回输入值（并回填初值）', async () => {
    mountHost();
    const result = useDialog().prompt({ title: '重命名', initialValue: '旧名' });
    await tick();
    const input = byTestId('dialog-prompt-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.value).toBe('旧名');
    if (input) {
      input.value = '新名';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await tick();
    byTestId('dialog-ok')?.click();
    await tick();
    await expect(result).resolves.toBe('新名');
  });

  it('prompt 按 Enter 提交输入值', async () => {
    mountHost();
    const result = useDialog().prompt({ title: '重命名', initialValue: '' });
    await tick();
    const input = byTestId('dialog-prompt-input') as HTMLInputElement | null;
    if (input) {
      input.value = '回车提交';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await tick();
    byTestId('dialog-panel')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await tick();
    await expect(result).resolves.toBe('回车提交');
  });

  it('prompt 按 Esc resolves null', async () => {
    mountHost();
    const result = useDialog().prompt({ title: '重命名', initialValue: 'x' });
    await tick();
    byTestId('dialog-panel')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await tick();
    await expect(result).resolves.toBeNull();
  });
});
