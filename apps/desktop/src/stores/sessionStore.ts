import { create } from 'zustand';
import type { CodingSession } from '@music-coding/shared-types';

interface SessionStore {
  current: CodingSession | null;
  recent: CodingSession[];
  // 设置当前 Session（同时同步到 agentStore 和 musicStore）
  setCurrent: (session: CodingSession) => void;
  // 设置活跃 Session ID（同步到其他 stores）
  setActiveSession: (sessionId: string) => void;
  addSession: (session: CodingSession) => void;
  removeSession: (id: string) => void;
  updateSession: (id: string, patch: Partial<CodingSession>) => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  current: null,
  recent: [],

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
      return {
        current: newCurrent,
        recent: state.recent.filter((s) => s.id !== id),
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
