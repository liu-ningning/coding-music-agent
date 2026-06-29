import { useSettingsStore } from '@/stores/settingsStore';
import { SIDECAR_BASE } from '@/config';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  time: string;
  module: string;
  level: LogLevel;
  message: string;
  source?: 'frontend' | 'sidecar';
}

const logs: LogEntry[] = [];
const MAX_LINES = 50;

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: '#4ade80',
  warn: '#facc15',
  error: '#f87171',
};

// ── 前端日志 ──

export function debugLog(module: string, message: string, level: LogLevel = 'info'): void {
  const showDebug = useSettingsStore.getState().showDebug;
  if (!showDebug) return;

  const time = new Date().toLocaleTimeString();
  logs.push({ time, module, level, message, source: 'frontend' });
  if (logs.length > MAX_LINES) logs.shift();
  renderPanel();
}

export const debugInfo = (module: string, msg: string) => debugLog(module, msg, 'info');
export const debugWarn = (module: string, msg: string) => debugLog(module, msg, 'warn');
export const debugError = (module: string, msg: string) => debugLog(module, msg, 'error');

// ── Sidecar 日志订阅 ──

let sidecarSource: EventSource | null = null;

export function startSidecarLogStream(): void {
  if (sidecarSource) return;

  // 先加载最近日志
  fetch(`${SIDECAR_BASE}/logs/recent?count=30`)
    .then((r) => r.json())
    .then((entries: LogEntry[]) => {
      for (const entry of entries) {
        entry.source = 'sidecar';
        logs.push(entry);
      }
      if (logs.length > MAX_LINES) logs.splice(0, logs.length - MAX_LINES);
      renderPanel();
    })
    .catch(() => {});

  // 订阅实时日志
  sidecarSource = new EventSource(`${SIDECAR_BASE}/events/logs`);
  sidecarSource.onmessage = (event) => {
    const showDebug = useSettingsStore.getState().showDebug;
    if (!showDebug) return;

    try {
      const entry: LogEntry = JSON.parse(event.data);
      entry.source = 'sidecar';
      logs.push(entry);
      if (logs.length > MAX_LINES) logs.shift();
      renderPanel();
    } catch {
      // 忽略解析错误
    }
  };

  sidecarSource.onerror = () => {
    // 连接断开，3 秒后重连
    sidecarSource?.close();
    sidecarSource = null;
    setTimeout(startSidecarLogStream, 3000);
  };
}

export function stopSidecarLogStream(): void {
  sidecarSource?.close();
  sidecarSource = null;
}

// ── 清空 ──

export function clearDebugLog(): void {
  logs.length = 0;
  const el = document.getElementById('debug-log-panel');
  if (el) el.style.display = 'none';
  // 同步清空 Sidecar 日志缓冲区
  fetch(`${SIDECAR_BASE}/logs`, { method: 'DELETE' }).catch(() => {});
}

// ── 渲染浮层面板 ──

function renderPanel(): void {
  const showDebug = useSettingsStore.getState().showDebug;
  if (!showDebug) {
    const el = document.getElementById('debug-log-panel');
    if (el) el.style.display = 'none';
    return;
  }

  let el = document.getElementById('debug-log-panel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'debug-log-panel';
    el.style.cssText = [
      'position:fixed', 'bottom:60px', 'left:10px', 'z-index:99999',
      'background:rgba(0,0,0,0.88)', 'font-size:11px',
      'font-family:monospace', 'border-radius:6px', 'max-width:520px',
      'max-height:260px', 'display:flex', 'flex-direction:column',
      'backdrop-filter:blur(4px)', 'overflow:hidden',
    ].join(';');

    // 顶栏：标题 + 清空按钮
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 10px;border-bottom:1px solid rgba(255,255,255,0.1);flex-shrink:0;';
    header.innerHTML = '<span style="color:#94a3b8;font-size:10px;">调试日志</span>';

    const btn = document.createElement('button');
    btn.textContent = '清空';
    btn.style.cssText = 'background:rgba(255,255,255,0.1);color:#94a3b8;border:none;border-radius:3px;padding:1px 8px;font-size:10px;cursor:pointer;line-height:1.6;';
    btn.onmouseenter = () => { btn.style.background = 'rgba(255,255,255,0.2)'; };
    btn.onmouseleave = () => { btn.style.background = 'rgba(255,255,255,0.1)'; };
    btn.onclick = (e) => { e.stopPropagation(); clearDebugLog(); };
    header.appendChild(btn);

    el.appendChild(header);

    // 日志内容区
    const body = document.createElement('div');
    body.id = 'debug-log-body';
    body.style.cssText = 'padding:6px 10px;overflow-y:auto;max-height:220px;line-height:1.5;flex:1;';
    el.appendChild(body);

    document.body.appendChild(el);
  }

  const body = document.getElementById('debug-log-body');
  if (!body) return;

  body.innerHTML = logs
    .map((l) => {
      const c = LEVEL_COLOR[l.level];
      const tag = l.level === 'info' ? '' : ` [${l.level.toUpperCase()}]`;
      const icon = l.source === 'sidecar' ? '<span style="color:#58A6A6">●</span> ' : '';
      const mod = l.module;
      return `<div style="color:${c}"><span style="opacity:0.5">${l.time}</span> ${icon}<span style="color:#94a3b8">[${mod}]</span>${tag} ${l.message}</div>`;
    })
    .join('');

  body.scrollTop = body.scrollHeight;
  el.style.display = logs.length > 0 ? 'flex' : 'none';
}
