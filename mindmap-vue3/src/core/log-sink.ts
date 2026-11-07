/**
 * 日志落盘分发器（纯模块，共享于 Web + Tauri，必须两端字节一致）
 *
 * 设计: 共享的 logger 只负责把日志"发出去"，具体是否/如何落盘由平台决定。
 * - Web 端永远不注册 sink → emitLog 是 no-op（满足 AGENTS.md：Web 不伪造能力）。
 * - Tauri 端在 App.vue 注册 sink，按需把 warn/error 追加写 userData/logs/naotu.log。
 *
 * 关键红线: 落盘内容只含人类可读的消息文本，绝不携带 extra（防止 API key 入盘）。
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/** 落盘回调：level 为已转大写的级别，line 为已格式化的人类可读行（不含 extra）。 */
export type LogSink = (level: LogLevel, line: string) => void;

let sink: LogSink | null = null;

/** 注册平台专属的日志落盘实现（传 null 清空）。 */
export function setLogSink(fn: LogSink | null): void {
  sink = fn;
}

/** 把一行日志交给已注册的 sink；未注册时静默 no-op。 */
export function emitLog(level: LogLevel, line: string): void {
  sink?.(level, line);
}
