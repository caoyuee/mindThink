/**
 * 全局错误处理
 *
 * 设计:
 * - 集成 Vue app.config.errorHandler
 * - 错误冒泡为 Toast
 * - 严重错误触发 ErrorBoundary 重置（可选）
 */

import type { App } from 'vue';
import { useToastStore } from './useToast';
import { logger } from '@/core/logger';

export function setupErrorHandler(app: App): void {
  const toast = useToastStore();

  // Vue 渲染/生命周期错误
  app.config.errorHandler = (err, instance, info) => {
    logger.error(`Vue error [${info}]`, err);
    toast.error(`应用错误: ${(err as Error).message ?? String(err)}`);
  };

  // 未捕获的 Promise 拒绝
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', event.reason);
    toast.error(`未处理的错误: ${(event.reason as Error)?.message ?? event.reason}`);
    event.preventDefault();
  });

  // 未捕获的同步错误
  window.addEventListener('error', (event) => {
    logger.error('Uncaught error', event.error);
  });
}
