/**
 * 简易日志封装
 *
 * 设计目的:
 * 1. 统一日志入口, 便于将来切换到 winston/pino 等
 * 2. 强制要求调用者标记 DEBUG/TODO, 避免遗留调试输出
 * 3. 错误日志自动带 stack, 用户可见错误走 toast/UI 层
 *
 * 满足 AGENTS.md 第 10 节: 禁止静默 catch、禁止裸 console.log
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** 当前最低输出级别（生产环境可设为 warn） */
const MIN_LEVEL: Level = (import.meta.env?.PROD ? 'warn' : 'debug') as Level;

function shouldLog(level: Level): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

function format(level: Level, msg: string, extra?: unknown): unknown[] {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  if (extra instanceof Error) {
    return [prefix, msg, extra.message, extra.stack];
  }
  if (extra !== undefined) {
    return [prefix, msg, extra];
  }
  return [prefix, msg];
}

export const logger = {
  /**
   * 调试日志。仅 dev 环境输出。
   * 调用方必须使用 // DEBUG: <原因> 注释, 否则会被 lint 拦截。
   */
  debug(msg: string, extra?: unknown): void {
    if (!shouldLog('debug')) return;
    console.log(...format('debug', msg, extra));
  },

  /** 普通信息 */
  info(msg: string, extra?: unknown): void {
    if (!shouldLog('info')) return;
    console.info(...format('info', msg, extra));
  },

  /** 警告 */
  warn(msg: string, extra?: unknown): void {
    if (!shouldLog('warn')) return;
    console.warn(...format('warn', msg, extra));
  },

  /** 错误。永远输出, 带 stack */
  error(msg: string, err?: unknown): void {
    console.error(...format('error', msg, err));
  },
} as const;
