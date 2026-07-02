import { create } from 'zustand';
import type { CodingSession } from '@music-coding/shared-types';

const PINNED_KEY = 'music-coding-pinned-sessions';
const ACTIVE_TIME_KEY = 'music-coding-active-time';

// 每个 Session 的活跃时间数据
interface ActiveTimeData {
  activeDurationMs: number;  // 累计活跃时长（毫秒）
  activeSince: number | null; // 当前活跃开始时间戳，null 表示未激活
}

interface SessionStore {
  current: CodingSession | null;
  recent: CodingSession[];
  pinnedIds: Set<string>;
  activeTimeMap: Record<string, ActiveTimeData>;
  // 设置当前 Session（同时同步到 agentStore 和 musicStore）
  setCurrent: (session: CodingSession) => void;
  // 设置活跃 Session ID（同步到其他 stores）
  setActiveSession: (sessionId: string) => void;
  addSession: (session: CodingSession) => void;
  removeSession: (id: string) => void;
  updateSession: (id: string, patch: Partial<CodingSession>) => void;
  togglePin: (id: string) => void;
  // 获取 Session 的活跃时长（毫秒）
  getActiveDuration: (sessionId: string) => number;
}

// 从 localStorage 加载置顶 Session
function loadPinnedFromStorage(): Set<string> {
  try {
    const stored = localStorage.getItem(PINNED_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set();
}

// 保存置顶 Session 到 localStorage
function savePinnedToStorage(ids: Set<string>): void {
  try {
    localStorage.setItem(PINNED_KEY, JSON.stringify([...ids]));
  } catch {}
}

// 从 localStorage 加载活跃时间数据
function loadActiveTimeFromStorage(): Record<string, ActiveTimeData> {
  try {
    const stored = localStorage.getItem(ACTIVE_TIME_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

// 保存活跃时间数据到 localStorage
function saveActiveTimeToStorage(data: Record<string, ActiveTimeData>): void {
  try {
    // 保存时清除 activeSince（持久化只保留累计时长）
    const toSave: Record<string, ActiveTimeData> = {};
    for (const [id, val] of Object.entries(data)) {
      toSave[id] = { activeDurationMs: val.activeDurationMs, activeSince: null };
    }
    localStorage.setItem(ACTIVE_TIME_KEY, JSON.stringify(toSave));
  } catch {}
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  current: null,
  recent: [],
  pinnedIds: loadPinnedFromStorage(),
  activeTimeMap: loadActiveTimeFromStorage(),

  setCurrent: (session) => {
    const { current, activeTimeMap } = get();
    const now = Date.now();
    const newMap = { ...activeTimeMap };

    // 旧 Session 停止计时
    if (current && current.id !== session.id && newMap[current.id]?.activeSince) {
      newMap[current.id] = {
        activeDurationMs: newMap[current.id].activeDurationMs + (now - newMap[current.id].activeSince!),
        activeSince: null,
      };
    }

    // 新 Session 开始计时
    if (!newMap[session.id]) {
      newMap[session.id] = { activeDurationMs: 0, activeSince: now };
    } else {
      newMap[session.id] = { ...newMap[session.id], activeSince: now };
    }

    set({ current: session, activeTimeMap: newMap });
    saveActiveTimeToStorage(newMap);
    syncToOtherStores(session.id);
  },

  setActiveSession: (sessionId) => {
    const { recent, current, activeTimeMap } = get();
    const session = recent.find(s => s.id === sessionId);
    if (session) {
      const now = Date.now();
      const newMap = { ...activeTimeMap };

      // 旧 Session 停止计时
      if (current && current.id !== sessionId && newMap[current.id]?.activeSince) {
        newMap[current.id] = {
          activeDurationMs: newMap[current.id].activeDurationMs + (now - newMap[current.id].activeSince!),
          activeSince: null,
        };
      }

      // 新 Session 开始计时
      if (!newMap[sessionId]) {
        newMap[sessionId] = { activeDurationMs: 0, activeSince: now };
      } else {
        newMap[sessionId] = { ...newMap[sessionId], activeSince: now };
      }

      set({ current: session, activeTimeMap: newMap });
      saveActiveTimeToStorage(newMap);
      syncToOtherStores(sessionId);
    }
  },

  addSession: (session) => {
    const { current, activeTimeMap } = get();
    const now = Date.now();
    const newMap = { ...activeTimeMap };

    // 旧 Session 停止计时
    if (current && current.id !== session.id && newMap[current.id]?.activeSince) {
      newMap[current.id] = {
        activeDurationMs: newMap[current.id].activeDurationMs + (now - newMap[current.id].activeSince!),
        activeSince: null,
      };
    }

    // 新 Session 开始计时
    newMap[session.id] = { activeDurationMs: 0, activeSince: now };

    set((state) => ({
      current: session,
      recent: [session, ...state.recent.filter((s) => s.id !== session.id)],
      activeTimeMap: newMap,
    }));
    saveActiveTimeToStorage(newMap);
    syncToOtherStores(session.id);
  },

  removeSession: (id) => {
    set((state) => {
      const newCurrent = state.current?.id === id ? null : state.current;
      // 同时移除置顶
      const newPinned = new Set(state.pinnedIds);
      newPinned.delete(id);
      savePinnedToStorage(newPinned);
      return {
        current: newCurrent,
        recent: state.recent.filter((s) => s.id !== id),
        pinnedIds: newPinned,
      };
    });
  },

  updateSession: (id, patch) =>
    set((state) => {
      const updated = state.recent.map((s) =>
        s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s,
      );
      return {
        recent: updated,
        current: state.current?.id === id
          ? { ...state.current, ...patch, updatedAt: new Date().toISOString() }
          : state.current,
      };
    }),

  togglePin: (id) => {
    set((state) => {
      const newPinned = new Set(state.pinnedIds);
      if (newPinned.has(id)) {
        newPinned.delete(id);
      } else {
        newPinned.add(id);
      }
      savePinnedToStorage(newPinned);
      return { pinnedIds: newPinned };
    });
  },

  getActiveDuration: (sessionId) => {
    const { activeTimeMap } = get();
    const data = activeTimeMap[sessionId];
    if (!data) return 0;
    const base = data.activeDurationMs;
    const current = data.activeSince ? Date.now() - data.activeSince : 0;
    return base + current;
  },
}));

// 同步到 agentStore 和 musicStore
function syncToOtherStores(sessionId: string) {
  // 动态导入避免循环依赖
  import('./agentStore').then(({ useAgentStore }) => {
    useAgentStore.getState().setActiveSession(sessionId);
    useAgentStore.getState().initSession(sessionId);
  });

  import('./musicStore').then(({ useMusicStore }) => {
    const musicStore = useMusicStore.getState();
    musicStore.setActiveSession(sessionId);
    musicStore.initSession(sessionId);

    // 如果该 Session 没有推荐，自动获取
    const sessionData = musicStore.sessions[sessionId];
    if (!sessionData?.recommendation) {
      import('@/clients/musicClient').then(({ fetchRecommendation }) => {
        fetchRecommendation();
      });
    }
  });
}
