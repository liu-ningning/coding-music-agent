import { EventEmitter } from 'events';

type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  time: string;
  module: string;
  level: LogLevel;
  message: string;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = { info: 0, warn: 1, error: 2 };
const LEVEL_COLOR: Record<LogLevel, string> = { info: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET = '\x1b[0m';

// 日志事件总线（供 SSE 端点订阅）
export const logEvents = new EventEmitter();

// 日志缓冲区（供 API 查询最近日志）
const logBuffer: LogEntry[] = [];
const MAX_BUFFER = 200;

// 通过环境变量控制日志级别，默认 info
const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const minLevel: LogLevel = (['info', 'warn', 'error'].includes(envLevel) ? envLevel : 'info') as LogLevel;

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function timestamp(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function write(level: LogLevel, module: string, message: string): void {
  if (!shouldLog(level)) return;

  const ts = timestamp();
  const entry: LogEntry = { time: ts, module, level, message };

  // 写入缓冲区
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER) logBuffer.shift();

  // 发射事件（SSE 用）
  logEvents.emit('log', entry);

  // 输出到终端
  const color = LEVEL_COLOR[level];
  const tag = level === 'info' ? '' : ` ${level.toUpperCase()}`;
  console.log(`${color}[${ts}] [${module}]${tag}${RESET} ${message}`);
}

// 获取最近日志
export function getRecentLogs(count: number = 50): LogEntry[] {
  return logBuffer.slice(-count);
}

// 清空日志缓冲区
export function clearLogs(): void {
  logBuffer.length = 0;
}

// 导出工厂函数，绑定模块名
export function createLogger(module: string) {
  return {
    info: (msg: string) => write('info', module, msg),
    warn: (msg: string) => write('warn', module, msg),
    error: (msg: string) => write('error', module, msg),
  };
}
