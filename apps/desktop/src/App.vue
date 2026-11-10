<script setup lang="ts">
/**
 * 应用根组件
 *
 * 布局:
 * - AppHeader (路由 + 语言 + 主题)
 * - <RouterView /> (路由级页面: editor / settings / about)
 * - AppStatusBar (撤销/重做 + 文档概要)
 * - Toast (全局通知)
 *
 * Tauri 集成: 平台检测在 useUiStore 初始化时自动完成,
 * 与 AGENTS.md "禁止直接修改环境" 一致。
 */
import { onBeforeUnmount, onMounted, watch } from 'vue';
import { listen, type Event as TauriEvent, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppStatusBar from '@/components/layout/AppStatusBar.vue';
import Toast from '@/components/common/Toast.vue';
import DialogHost from '@/components/dialogs/DialogHost.vue';
import { useUiStore } from '@/stores/ui';
import { useMindmapStore } from '@/stores/mindmap';
import { useConfigStore } from '@/stores/config';
import { useToastStore } from '@/composables/useToast';
import { useDialog } from '@/composables/useDialog';
import { useI18n } from 'vue-i18n';
import { detectPlatform, registerDirPicker, registerMcpStatusProvider } from '@/platform';
import { fileApi } from '@/core/file';
import { createMcpContext, parseMcpRpcRequest } from '@/core/mcp';
import { handleMcpServerRpc, type ApplyOpsOutcome, type McpServerDeps } from '@/core/mcp-server';
import type { MindMapOp } from '@/core/ops';
import { router } from '@/router';
import { buildDocumentTitle } from '@/core/document-title';
import { buildMenuSpec } from '@/core/menu-spec';
import {
  tauriRebuildNativeMenu,
  tauriAppendLogLine,
  tauriOpenDialog,
  tauriMcpStart,
  tauriMcpStop,
  tauriMcpRespond,
  tauriMcpStatus,
} from '@/core/tauri-file';
import { setLogSink } from '@/core/log-sink';
import { logger } from '@/core/logger';

const ui = useUiStore();
const toast = useToastStore();
const { t, locale } = useI18n();
const dialog = useDialog();

/**
 * Tauri 启动横幅(spike 阶段显示)
 * 上线后这里展示版本更新日志
 */
const platform = detectPlatform();
const mindmap = useMindmapStore();
const config = useConfigStore();
let stopMenuListener: UnlistenFn | null = null;
let stopCloseListener: UnlistenFn | null = null;
let stopDragListener: UnlistenFn | null = null;
let stopMcpListener: UnlistenFn | null = null;
let autoSaveTimer: number | null = null;

watch(
  [
    () => mindmap.documentPath,
    () => mindmap.doc.root.text,
    () => mindmap.isDirty,
    () => t('app.name'),
  ],
  () => {
    const title = buildDocumentTitle(
      mindmap.documentPath,
      mindmap.doc.root.text,
      mindmap.isDirty,
      t('app.name'),
      t('statusbar.untitledDocument'),
    );
    document.title = title;
    if (platform === 'tauri') {
      void getCurrentWindow()
        .setTitle(title)
        .catch((error: unknown) => logger.warn('更新窗口标题失败', error));
    }
  },
  { immediate: true },
);

// —— MCP server 桥接（D5 阶段一）：传输在 Rust，协议业务在 webview ——

/** 把 ops 转成批准对话框里的逐行摘要。 */
function formatOpsSummary(ops: MindMapOp[]): string {
  return ops
    .map((op) => {
      switch (op.op) {
        case 'add_child':
          return `[add_child] "${op.text}" → parent ${op.parentId}`;
        case 'add_sibling':
          return `[add_sibling] "${op.text}" → sibling ${op.siblingId}`;
        case 'update_node': {
          const parts: string[] = [`[update_node] ${op.nodeId}`];
          if (op.text !== undefined) parts.push(`text="${op.text}"`);
          if (op.note !== undefined)
            parts.push(op.note === null ? 'note=清除' : `note="${op.note}"`);
          return parts.join(' ');
        }
        case 'delete_node':
          return `[delete_node] ${op.nodeId}`;
      }
    })
    .join('\n');
}

/** MCP 写链路：默认弹批准对话框（fail-closed），设置开启后自动批准。 */
async function mcpApplyOps(ops: MindMapOp[]): Promise<ApplyOpsOutcome> {
  if (config.userConfig.mcpAutoApproveWrites) {
    const outcome = mindmap.applyExternalOps(ops);
    return { approved: true, results: outcome.results, appliedCount: outcome.appliedCount };
  }
  const approved = await dialog.confirm({
    title: t('mcp.approvalTitle'),
    message: `${t('mcp.approvalIntro')}\n\n${formatOpsSummary(ops)}`,
    okText: t('mcp.approve'),
    cancelText: t('mcp.reject'),
  });
  if (!approved) return { approved: false, reason: t('mcp.rejectedReason') };
  const outcome = mindmap.applyExternalOps(ops);
  return { approved: true, results: outcome.results, appliedCount: outcome.appliedCount };
}

function mcpServerDeps(): McpServerDeps {
  return {
    getContext: () => createMcpContext(mindmap.doc),
    applyOps: mcpApplyOps,
    exportMarkdown: () => createMcpContext(mindmap.doc).current.markdown,
  };
}

/** Rust 传输层转发来的 JSON-RPC 请求 → 协议分发 → 回传。必须始终回包（否则 Rust 侧 30s 超时）。 */
async function handleMcpBridgeRequest(payload: { rid: number; message: unknown }): Promise<void> {
  let response: Record<string, unknown>;
  try {
    const request = parseMcpRpcRequest(payload.message);
    const result = await handleMcpServerRpc(request, mcpServerDeps());
    response = (result ?? { jsonrpc: '2.0', id: request.id ?? null }) as Record<string, unknown>;
  } catch (error) {
    const raw = payload.message as Record<string, unknown> | null;
    const id =
      raw && (typeof raw['id'] === 'string' || typeof raw['id'] === 'number') ? raw['id'] : null;
    response = { jsonrpc: '2.0', id, error: { code: -32603, message: (error as Error).message } };
  }
  await tauriMcpRespond(payload.rid, JSON.stringify(response));
}

/** 按 mcpEnabled 同步 server 生命周期（启动/停止均幂等）。 */
async function syncMcpServer(): Promise<void> {
  if (platform !== 'tauri') return;
  try {
    if (config.userConfig.mcpEnabled) await tauriMcpStart();
    else await tauriMcpStop();
  } catch (error) {
    logger.warn('MCP server 状态同步失败', error);
    toast.warn(`${t('mcp.statusSyncFailed')}: ${(error as Error).message}`);
  }
}

watch(
  () => config.userConfig.mcpEnabled,
  () => {
    void syncMcpServer();
  },
);

async function confirmDiscard(mindmap: ReturnType<typeof useMindmapStore>): Promise<boolean> {
  if (!mindmap.isDirty) return true;
  return dialog.confirm({
    title: t('common.confirm'),
    message: t('document.discardChanges'),
    okText: t('common.ok'),
    cancelText: t('common.cancel'),
  });
}

async function handleMenuEvent(id: string): Promise<void> {
  const mindmap = useMindmapStore();
  // 原生「最近打开」子菜单交互：
  // - `recent:<path>`：打开该路径（先确认是否丢弃未保存更改）
  // - `recent-clear`：清空最近记录
  // - `recent-none`：占位项，无操作
  if (id.startsWith('recent:')) {
    const path = id.slice('recent:'.length);
    if (await confirmDiscard(mindmap)) await mindmap.openRecent(path);
    return;
  }
  if (id === 'recent-clear') {
    config.clearRecentFiles();
    return;
  }
  try {
    switch (id) {
      case 'new':
        if (await confirmDiscard(mindmap)) mindmap.reset();
        break;
      case 'open':
        if (await confirmDiscard(mindmap)) await mindmap.open();
        break;
      case 'new-window':
        if (platform === 'tauri') {
          const label = `editor-${Date.now()}`;
          const child = new WebviewWindow(label, {
            title: t('app.name'),
            url: '/editor',
            width: 1200,
            height: 800,
            minWidth: 700,
            minHeight: 700,
            center: true,
          });
          await child.once('tauri://error', (event: TauriEvent<unknown>) => {
            toast.error(`${t('toast.error')}: ${String(event.payload)}`);
          });
        }
        break;
      case 'save':
        await mindmap.save();
        break;
      case 'undo':
        mindmap.undo();
        break;
      case 'redo':
        mindmap.redo();
        break;
      case 'toggle-devtools':
        toast.info(t('menu.devtoolsUnavailable'));
        break;
      case 'about':
        await router.push('/about');
        break;
      default:
        break;
    }
  } catch (error) {
    toast.error(`${t('toast.error')}: ${(error as Error).message}`);
  }
}

/** 按当前 UI 语言与最近文件列表重建系统原生菜单(桌面端)。失败 toast, 不阻塞 UI。 */
function rebuildMenu(): void {
  if (platform !== 'tauri') return;
  const spec = buildMenuSpec((key) => t(key), config.userConfig.recentFiles);
  void tauriRebuildNativeMenu(spec).catch((error: unknown) => {
    toast.warn(`${t('toast.error')}: ${(error as Error).message}`);
  });
}

/** 节流重建原生菜单（最近文件变化可能高频触发，见 M0-4 规格 300ms）。 */
let rebuildMenuTimer: number | undefined;
function scheduleRebuildMenu(): void {
  if (rebuildMenuTimer !== undefined) window.clearTimeout(rebuildMenuTimer);
  rebuildMenuTimer = window.setTimeout(() => {
    rebuildMenuTimer = undefined;
    rebuildMenu();
  }, 300);
}

watch(
  () => locale.value,
  () => {
    if (platform === 'tauri') rebuildMenu();
  },
);

watch(
  () => config.userConfig.recentFiles,
  () => {
    if (platform === 'tauri') scheduleRebuildMenu();
  },
);

onMounted(async () => {
  // 初始化主题(同步 pinia store 也会做)
  document.documentElement.dataset['theme'] = ui.theme;

  if (platform === 'tauri') {
    autoSaveTimer = window.setInterval(() => {
      if (config.userConfig.isAutoSave && mindmap.isDirty && mindmap.documentPath) {
        void mindmap.save({ backup: true }).catch((error: unknown) => {
          toast.error(`${t('toast.error')}: ${(error as Error).message}`);
        });
      }
    }, 30_000);
    try {
      const currentWindow = getCurrentWindow();
      stopCloseListener = await currentWindow.onCloseRequested(async (event) => {
        if (!(await confirmDiscard(useMindmapStore()))) event.preventDefault();
      });
      stopMenuListener = await listen<string>('menu_event', (event) => {
        void handleMenuEvent(event.payload);
      });
      stopMcpListener = await listen<{ rid: number; message: unknown }>('mcp-request', (event) => {
        void handleMcpBridgeRequest(event.payload);
      });
      // 按用户设置启动 MCP server（幂等；关闭状态则清理残留发现文件）
      void syncMcpServer();
      stopDragListener = await listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
        const path = event.payload.paths[0];
        if (!path) return;
        if (!/\.(md|markdown|km)$/i.test(path)) {
          toast.warn(t('document.unsupportedFile'));
          return;
        }
        void confirmDiscard(mindmap).then((canOpen) => {
          if (canOpen) void mindmap.openRecent(path);
        });
      });
      const version = await fileApi.getAppVersion();
      toast.info(`${t('app.name')} v${version} (Tauri)`, 5000);
      // 覆盖 Rust 启动时的默认英文菜单, 让菜单跟随当前 UI 语言。
      rebuildMenu();

      // 注册平台专属能力（共享模块使用注册式分发，Web 端不注册）。
      registerDirPicker(async () => {
        const selected = await tauriOpenDialog({
          directory: true,
          title: t('settings.chooseDir'),
        });
        return typeof selected === 'string' ? selected : null;
      });
      registerMcpStatusProvider(() => tauriMcpStatus());
      // 日志落盘 sink：仅当用户开启 ifSaveLogToDisk 时写盘（落盘内容不含 API key）。
      setLogSink((_level, line) => {
        if (config.userConfig.ifSaveLogToDisk) {
          void tauriAppendLogLine(line).catch((error: unknown) => {
            logger.warn('写日志到磁盘失败', error);
          });
        }
      });
    } catch (e) {
      toast.warn(`${t('app.tauriStartupFailed')}: ${(e as Error).message}`);
    }
  }
});

onBeforeUnmount(() => {
  if (autoSaveTimer !== null) window.clearInterval(autoSaveTimer);
  stopMenuListener?.();
  stopCloseListener?.();
  stopDragListener?.();
  stopMcpListener?.();
  stopMenuListener = null;
  stopCloseListener = null;
  stopDragListener = null;
  stopMcpListener = null;
  // 关窗清理：停掉 MCP server 并移除发现文件（幂等；失败只记日志）
  void tauriMcpStop().catch((error: unknown) => logger.warn('MCP server 停止失败', error));
});

/** 全局快捷键：Mod+/ 跳转到快捷键说明页。 */
function onGlobalKeydown(e: KeyboardEvent): void {
  if (e.key !== '/') return;
  const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
  if (!mod) return;
  const target = e.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  ) {
    return;
  }
  e.preventDefault();
  void router.push('/shortcuts');
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown);
});
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <main class="app-main">
      <RouterView />
    </main>
    <AppStatusBar />
    <Toast />
    <DialogHost />
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
}
.app-main {
  overflow: hidden;
  min-height: 0;
}
</style>
