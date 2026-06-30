import { create } from 'zustand';
import type { CodingSession } from '@music-coding/shared-types';

const PINNED_KEY = 'music-coding-pinned-sessions';

interface SessionStore {
  current: CodingSession | null;
  recent: CodingSession[];
  pinnedIds: Set<string>;
  // 设置当前 Session（同时同步到 agentStore 和 musicStore）
  setCurrent: (session: CodingSession) => void;
  // 设置活跃 Session ID（同步到其他 stores）
  setActiveSession: (sessionId: string) => void;
  addSession: (session: CodingSession) => void;
  removeSession: (id: string) => void;
  updateSession: (id: string, patch: Partial<CodingSession>) => void;
  togglePin: (id: string) => void;
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

export const useSessionStore = create<SessionStore>((set, get) => ({
  current: null,
  recent: [],
  pinnedIds: loadPinnedFromStorage(),

  setCurrent: (session) => {
    set({ current: session });
    // 同步到其他 stores
    syncToOtherStores(session.id);
  },

  setActiveSession: (sessionId) => {
    const { recent } = get();
    const session = recent.find(s => s.id === sessionId);
    if (session) {
      set({ current: session });
      syncToOtherStores(sessionId);
    }
  },

  addSession: (session) => {
    set((state) => ({
      current: session,
      recent: [session, ...state.recent.filter((s) => s.id !== session.id)],
    }));
    // 同步到其他 stores
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
}));

// 同步到 agentStore 和 musicStore
function syncToOtherStores(sessionId: string) {
  // 动态导入避免循环依赖
  import('./agentStore').then(({ useAgentStore }) => {
    useAgentStore.getState().setActiveSession(sessionId);
    useAgentStore.getState().initSession(sessionId);
  });

  import('./musicStore').then(({ useMusicStore }) => {
    useMusicStore.getState().setActiveSession(sessionId);
    useMusicStore.getState().initSession(sessionId);
  });
}
