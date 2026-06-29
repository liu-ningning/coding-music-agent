import { create } from 'zustand';
import type {
  AgentMessage,
  AgentRunStatus,
  ToolCallRequest,
  ApprovalRequest,
  AppError,
} from '@music-coding/shared-types';

// 思考步骤记录
interface ThinkingLogEntry {
  id: string;
  text: string;
  timestamp: number;
  type: 'info' | 'tool' | 'error';
  duration?: number; // 思考时长（毫秒）
  details?: string; // 详细信息
}

// 每个 Session 的 Agent 状态
interface SessionAgentData {
  messages: AgentMessage[];
  streamingContent: string;
  runStatus: AgentRunStatus;
  currentToolCall: ToolCallRequest | null;
  currentApproval: ApprovalRequest | null;
  error: AppError | null;
  thinkingStep: string;
  thinkingLogs: ThinkingLogEntry[];
  toolCallStartTime?: number;
}

const defaultSessionData = (): SessionAgentData => ({
  messages: [],
  streamingContent: '',
  runStatus: 'idle',
  currentToolCall: null,
  currentApproval: null,
  error: null,
  thinkingStep: '',
  thinkingLogs: [],
});

interface AgentStore {
  // 按 sessionId 存储的数据
  sessions: Record<string, SessionAgentData>;
  // 当前活跃的 sessionId
  activeSessionId: string | null;

  // 初始化 Session 数据
  initSession: (sessionId: string) => void;
  // 切换活跃 Session
  setActiveSession: (sessionId: string) => void;
  // 获取当前 Session 数据
  getCurrent: () => SessionAgentData;

  // 消息操作
  addMessage: (sessionId: string, msg: AgentMessage) => void;
  appendDelta: (sessionId: string, delta: string) => void;
  completeStreaming: (sessionId: string) => void;

  // 状态操作
  setRunStatus: (sessionId: string, status: AgentRunStatus) => void;
  setToolCall: (sessionId: string, call: ToolCallRequest | null) => void;
  setApproval: (sessionId: string, approval: ApprovalRequest | null) => void;
  setError: (sessionId: string, error: AppError | null) => void;
  setThinkingStep: (sessionId: string, step: string) => void;
  addThinkingLog: (sessionId: string, text: string, type?: 'info' | 'tool' | 'error', duration?: number, details?: string) => void;
  clearThinkingLogs: (sessionId: string) => void;
  updateThinkingLogDuration: (sessionId: string, logId: string, duration: number) => void;
  setToolCallStartTime: (sessionId: string, time: number) => void;
  clearSession: (sessionId: string) => void;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  sessions: {},
  activeSessionId: null,

  initSession: (sessionId) => {
    const { sessions } = get();
    if (!sessions[sessionId]) {
      set({
        sessions: {
          ...sessions,
          [sessionId]: defaultSessionData(),
        },
      });
    }
  },

  setActiveSession: (sessionId) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) {
      initSession(sessionId);
    }
    set({ activeSessionId: sessionId });
  },

  getCurrent: () => {
    const { sessions, activeSessionId } = get();
    if (activeSessionId && sessions[activeSessionId]) {
      return sessions[activeSessionId];
    }
    return defaultSessionData();
  },

  addMessage: (sessionId, msg) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    set({
      sessions: {
        ...sessions,
        [sessionId]: {
          ...sessionData,
          messages: [...sessionData.messages, msg],
        },
      },
    });
  },

  appendDelta: (sessionId, delta) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    set({
      sessions: {
        ...sessions,
        [sessionId]: {
          ...sessionData,
          streamingContent: sessionData.streamingContent + delta,
          runStatus: 'running',
        },
      },
    });
  },

  completeStreaming: (sessionId) => {
    const { sessions } = get();
    const sessionData = sessions[sessionId];
    if (!sessionData || !sessionData.streamingContent) return;

    const msg: AgentMessage = {
      id: `msg_${Date.now()}`,
      sessionId,
      role: 'assistant',
      content: sessionData.streamingContent,
      eventType: 'message',
      createdAt: new Date().toISOString(),
    };

    set({
      sessions: {
        ...sessions,
        [sessionId]: {
          ...sessionData,
          messages: [...sessionData.messages, msg],
          streamingContent: '',
        },
      },
    });
  },

  setRunStatus: (sessionId, status) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...sessionData, runStatus: status },
      },
    });
  },

  setToolCall: (sessionId, call) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...sessionData, currentToolCall: call },
      },
    });
  },

  setApproval: (sessionId, approval) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    set({
      sessions: {
        ...sessions,
        [sessionId]: {
          ...sessionData,
          currentApproval: approval,
          runStatus: approval ? 'waiting_approval' : 'running',
        },
      },
    });
  },

  setError: (sessionId, error) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...sessionData, error },
      },
    });
  },

  setThinkingStep: (sessionId, step) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...sessionData, thinkingStep: step },
      },
    });
  },

  addThinkingLog: (sessionId, text, type = 'info', duration, details) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    const newLog: ThinkingLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text,
      timestamp: Date.now(),
      type,
      duration,
      details,
    };
    set({
      sessions: {
        ...sessions,
        [sessionId]: {
          ...sessionData,
          thinkingLogs: [...sessionData.thinkingLogs, newLog],
        },
      },
    });
  },

  clearThinkingLogs: (sessionId) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...sessionData, thinkingLogs: [] },
      },
    });
  },

  updateThinkingLogDuration: (sessionId, logId, duration) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    const updatedLogs = sessionData.thinkingLogs.map(log =>
      log.id === logId ? { ...log, duration } : log
    );
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...sessionData, thinkingLogs: updatedLogs },
      },
    });
  },

  setToolCallStartTime: (sessionId, time) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...sessionData, toolCallStartTime: time },
      },
    });
  },

  clearSession: (sessionId) => {
    const { sessions } = get();
    const { [sessionId]: _, ...rest } = sessions;
    set({ sessions: rest });
  },
}));
