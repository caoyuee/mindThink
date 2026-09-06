/**
 * useDialog —— Promise 式对话框单例
 *
 * 兑现 AGENTS.md 红线 #7（"spike 阶段暂用 window.prompt/confirm，将在 dialogs/
 * 目录下替换"）。把散落在组件里的原生 confirm/prompt 收敛为 Promise 式调用：
 *
 *   const ok = await dialog.confirm({ title, message, okText, cancelText, danger });
 *   const text = await dialog.prompt({ title, initialValue, okText, cancelText });
 *
 * 实现：模块级单例保存一个"待处理弹窗"（payload 用 kind 区分 confirm/prompt，
 * 从而可被 TypeScript 收窄）。App 根上唯一挂载的 <DialogHost/> 订阅并渲染
 * ConfirmDialog / PromptDialog，再由它调用 settleDialog/failDialog 结束 Promise。
 * 组件层依赖本 composable 合法；core/ 不依赖本模块。
 */
import { reactive, readonly } from 'vue';

/** 确认弹窗选项：message 必填，danger 用于把"确定"标红并让焦点落在"取消"。 */
export interface ConfirmOptions {
  title: string;
  message: string;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
}

/** 单行输入弹窗选项：initialValue 在挂载后全选。 */
export interface PromptOptions {
  title: string;
  message?: string;
  initialValue?: string;
  okText?: string;
  cancelText?: string;
}

export type DialogKind = 'confirm' | 'prompt';

/** confirm → boolean；prompt → string（提交）| null（取消）。 */
export type DialogResult = boolean | string | null;

type DialogPayload =
  { kind: 'confirm'; options: ConfirmOptions } | { kind: 'prompt'; options: PromptOptions };

export interface ActiveDialog {
  payload: DialogPayload;
  resolve: (result: DialogResult) => void;
  reject: (reason?: unknown) => void;
}

interface DialogState {
  active: ActiveDialog | null;
}

// 同一会话内单例（跨多次 useDialog() 调用共享），DialogHost 只读订阅它。
const internalState = reactive<DialogState>({ active: null });

/** 供 <DialogHost/> 订阅渲染；普通调用方应使用 useDialog()。 */
export const dialogState = readonly(internalState);

function openDialog(payload: DialogPayload): Promise<DialogResult> {
  return new Promise<DialogResult>((resolve, reject) => {
    // 单弹窗模型：后开覆盖先开。Promise 式调用若被覆盖属极端时序，接受先开不 settle。
    internalState.active = { payload, resolve, reject };
  });
}

export interface UseDialog {
  confirm(options: ConfirmOptions): Promise<boolean>;
  prompt(options: PromptOptions): Promise<string | null>;
}

/** 在组件中调用；返回的 confirm/prompt 与全局 <DialogHost/> 配合。 */
export function useDialog(): UseDialog {
  return {
    confirm(options: ConfirmOptions): Promise<boolean> {
      return openDialog({ kind: 'confirm', options }) as Promise<boolean>;
    },
    prompt(options: PromptOptions): Promise<string | null> {
      return openDialog({ kind: 'prompt', options }) as Promise<string | null>;
    },
  };
}

/** 仅由 <DialogHost/> 调用：用户确认/取消时结束当前弹窗并 settle。 */
export function settleDialog(result: DialogResult): void {
  const active = internalState.active;
  if (!active) return;
  internalState.active = null;
  active.resolve(result);
}

/** 仅由 <DialogHost/> 调用：渲染异常等情况下拒绝当前弹窗。 */
export function failDialog(reason?: unknown): void {
  const active = internalState.active;
  if (!active) return;
  internalState.active = null;
  active.reject(reason);
}
