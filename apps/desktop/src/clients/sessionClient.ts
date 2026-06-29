import { useSessionStore } from '@/stores/sessionStore';
import { useAgentStore } from '@/stores/agentStore';
import type { CodingSession, AgentMessage } from '@music-coding/shared-types';
import { SIDECAR_BASE } from '@/config';
import { debugInfo, debugError } from '@/utils/debugLogger';
const SESSIONS_KEY = 'music-coding-sessions';
const MESSAGES_KEY = 'music-coding-messages';

// 检测运行环境
function getEnvPrefix(): string {
  // Tauri 2.x 注入 __TAURI_INTERNALS__
  if (typeof window !== 'undefined' && (
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    (window as any).__TAURI_INTERNALS__ !== undefined
  )) {
    return 'dsk';
  }
  return 'web';
}

// 生成 Session ID: web_1718520000 或 dsk_1718520000
function generateSessionId(): string {
  const prefix = getEnvPrefix();
  const timestamp = Math.floor(Date.now() / 1000);
  return `${prefix}_${timestamp}`;
}

// 生成 Session 名称: session-06-17-12-00-00
function generateSessionName(): string {
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  const second = now.getSeconds().toString().padStart(2, '0');

  const hourNum = now.getHours();
  let timeDesc = '';
  if (hourNum >= 6 && hourNum < 12) timeDesc = '上午';
  else if (hourNum >= 12 && hourNum < 18) timeDesc = '下午';
  else if (hourNum >= 18 && hourNum < 23) timeDesc = '晚上';
  else timeDesc = '深夜';

  return `${timeDesc}_session_${month}${day}_${hour}${minute}${second}`;
}

// ── Sessions ──

export function loadSessionsFromStorage(): void {
  try {
    const stored = localStorage.getItem(SESSIONS_KEY);
    if (stored) {
      const sessions: CodingSession[] = JSON.parse(stored);

      // 按创建时间倒序（最新在前）
      sessions.sort((a, b) => {
        const timeA = new Date(a.startedAt).getTime();
        const timeB = new Date(b.startedAt).getTime();
        return timeB - timeA;
      });

      // 直接设置 recent 列表，保持排序
      useSessionStore.setState({
        recent: sessions,
        current: sessions[0] || null,  // 默认选中最新的
      });

      debugInfo('session', `加载 ${sessions.length} 个会话`);

      // 加载消息
      loadMessagesFromStorage();
    }
  } catch (e) {
    debugError('session', `加载失败: ${e}`);
  }
}

function saveSessionsToStorage(): void {
  try {
    const { recent } = useSessionStore.getState();
    // 保存前按创建时间倒序
    const sorted = [...recent].sort((a, b) => {
      const timeA = new Date(a.startedAt).getTime();
      const timeB = new Date(b.startedAt).getTime();
      return timeB - timeA;
    });
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sorted));
  } catch (e) {
    debugError('session', `保存失败: ${e}`);
  }
}

// ── Messages ──

function loadMessagesFromStorage(): void {
  try {
    const stored = localStorage.getItem(MESSAGES_KEY);
    if (stored) {
      const allMessages: Record<string, AgentMessage[]> = JSON.parse(stored);

      // 直接批量设置，避免逐条添加导致的 activeSessionId 混乱
      const sessions: Record<string, any> = {};
      for (const [sessionId, messages] of Object.entries(allMessages)) {
        sessions[sessionId] = {
          messages,
          streamingContent: '',
          runStatus: 'idle',
          currentToolCall: null,
          currentApproval: null,
          error: null,
        };
      }

      useAgentStore.setState({ sessions });

      const total = Object.values(allMessages).reduce((sum, msgs) => sum + msgs.length, 0);
      debugInfo('session', `加载 ${total} 条消息`);
    }
  } catch (e) {
    debugError('session', `加载消息失败: ${e}`);
  }
}

function saveMessagesToStorage(): void {
  try {
    const { sessions } = useAgentStore.getState();
    const messagesToSave: Record<string, AgentMessage[]> = {};
    for (const [sessionId, data] of Object.entries(sessions)) {
      // 只保存有消息且不是空数据的 Session
      if (data.messages && data.messages.length > 0) {
        messagesToSave[sessionId] = data.messages;
      }
    }
    // 只有有数据时才保存
    if (Object.keys(messagesToSave).length > 0) {
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(messagesToSave));
    }
  } catch (e) {
    debugError('session', `保存消息失败: ${e}`);
  }
}

// ── Create Session ──

export async function createSession(title?: string, projectPath?: string): Promise<CodingSession> {
  const sessionId = generateSessionId();
  const sessionTitle = title || generateSessionName();

  // 强制校验：普通会话不允许访问目录
  // 只有明确传递 projectPath 时才允许访问目录
  const validatedProjectPath = projectPath ? projectPath : undefined;

  try {
    const res = await fetch(`${SIDECAR_BASE}/agent/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sessionId, title: sessionTitle, projectPath: validatedProjectPath }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const session: CodingSession = await res.json();

    const { addSession } = useSessionStore.getState();
    addSession(session);
    saveSessionsToStorage();

    debugInfo('session', `创建: ${session.id} ${session.title}`);
    return session;
  } catch (e) {
    debugError('session', `创建失败: ${e}`);
    throw e;
  }
}

// ── Init Sync ──

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function initSessionSync(): void {
  // 监听 session 变化
  useSessionStore.subscribe((state) => {
    if (state.recent.length > 0) {
      saveSessionsToStorage();
    }
  });

  // 监听 agent 消息变化（防抖，500ms 内只保存一次）
  useAgentStore.subscribe(() => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveMessagesToStorage();
    }, 500);
  });
}
