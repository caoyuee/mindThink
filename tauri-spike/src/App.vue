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
import { emit, listen, type Event as TauriEvent, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppStatusBar from '@/components/layout/AppStatusBar.vue';
import AiAssistant from '@/components/panels/AiAssistant.vue';
import Toast from '@/components/common/Toast.vue';
import DialogHost from '@/components/dialogs/DialogHost.vue';
import { useUiStore } from '@/stores/ui';
import { useMindmapStore } from '@/stores/mindmap';
import { useConfigStore } from '@/stores/config';
import { useToastStore } from '@/composables/useToast';
import { useDialog } from '@/composables/useDialog';
import { useI18n } from 'vue-i18n';
import { detectPlatform } from '@/platform';
import { fileApi } from '@/core/file';
import {
  createMcpContext,
  handleMcpRpcRequest as handleMcpRpcProtocol,
  parseMcpRequest,
  parseMcpRpcRequest,
} from '@/core/mcp';
import { router } from '@/router';
import { buildDocumentTitle } from '@/core/document-title';
import { buildMenuSpec } from '@/core/menu-spec';
import { tauriRebuildNativeMenu } from '@/core/tauri-file';
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
let stopMcpRpcListener: UnlistenFn | null = null;
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

function executeMcpTool(tool: string, args: Record<string, unknown>): unknown {
  switch (tool) {
    case 'get_current_mindmap':
      return createMcpContext(mindmap.doc).current;
    case 'update_node':
      if (typeof args['id'] !== 'string' || typeof args['text'] !== 'string') {
        throw new Error('update_node 需要 id 和 text');
      }
      mindmap.renameNode(args['id'], args['text']);
      return { ok: true };
    case 'add_node':
      if (typeof args['parentId'] !== 'string' || typeof args['text'] !== 'string') {
        throw new Error('add_node 需要 parentId 和 text');
      }
      mindmap.addChild(args['parentId'], args['text']);
      return { ok: true };
    default:
      throw new Error(`不支持的 MCP 工具: ${tool}`);
  }
}

async function handleMcpRequest(value: unknown): Promise<void> {
  let requestId = 'unknown';
  try {
    const request = parseMcpRequest(value);
    requestId = request.requestId;
    const result = executeMcpTool(request.tool, request.arguments ?? {});
    await emit('mcp_response', { requestId, ok: true, result });
  } catch (error) {
    await emit('mcp_response', { requestId, ok: false, error: (error as Error).message });
  }
}

async function handleMcpRpcRequest(value: unknown): Promise<void> {
  let response: ReturnType<typeof handleMcpRpcProtocol>;
  try {
    const request = parseMcpRpcRequest(value);
    if (request.method === 'tools/call') {
      const name = request.params?.['name'];
      const args = request.params?.['arguments'];
      if (typeof name !== 'string') throw new Error('tools/call 缺少 name');
      if (
        args !== undefined &&
        (typeof args !== 'object' || args === null || Array.isArray(args))
      ) {
        throw new Error('tools/call arguments 必须是对象');
      }
      const result = executeMcpTool(name, (args as Record<string, unknown> | undefined) ?? {});
      response = {
        jsonrpc: '2.0',
        id: request.id ?? null,
        result: { content: [{ type: 'text', text: JSON.stringify(result) }] },
      };
    } else {
      response = handleMcpRpcProtocol(request, createMcpContext(mindmap.doc));
    }
  } catch (error) {
    response = {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32602, message: (error as Error).message },
    };
  }
  await emit('mcp_rpc_response', response);
}

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
  try {
    switch (id) {
      case 'new':
        if (await confirmDiscard(mindmap)) mindmap.reset();
        break;
      case 'open':
        if (await confirmDiscard(mindmap)) await mindmap.open();
        break;
      case 'open-recent':
        await router.push('/editor');
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

/** 按当前 UI 语言重建系统原生菜单(桌面端)。失败 toast, 不阻塞 UI。 */
function rebuildMenu(): void {
  if (platform !== 'tauri') return;
  const spec = buildMenuSpec((key) => t(key));
  void tauriRebuildNativeMenu(spec).catch((error: unknown) => {
    toast.warn(`${t('toast.error')}: ${(error as Error).message}`);
  });
}

watch(
  () => locale.value,
  () => {
    if (platform === 'tauri') rebuildMenu();
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
      stopMcpListener = await listen<unknown>('mcp_request', (event) => {
        void handleMcpRequest(event.payload);
      });
      stopMcpRpcListener = await listen<unknown>('mcp_rpc_request', (event) => {
        void handleMcpRpcRequest(event.payload);
      });
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
  stopMcpRpcListener?.();
  stopMenuListener = null;
  stopCloseListener = null;
  stopDragListener = null;
  stopMcpListener = null;
  stopMcpRpcListener = null;
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
    <AiAssistant />
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
