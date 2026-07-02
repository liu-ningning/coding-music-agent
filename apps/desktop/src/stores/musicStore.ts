import { create } from 'zustand';
import type {
  MusicMode,
  MusicTrack,
  MusicRecommendation,
  PlaybackState,
} from '@music-coding/shared-types';

// 每个 Session 的音乐状态
interface SessionMusicData {
  recommendation: MusicRecommendation | null;
  mode: MusicMode;
  queue: MusicTrack[];
  currentIndex: number;
  /** 本次会话已播放的歌曲 ID 集合，用于去重推荐 */
  playedTrackIds: Set<string>;
}

const defaultSessionData = (): SessionMusicData => ({
  recommendation: null,
  mode: 'manual',
  queue: [],
  currentIndex: 0,
  playedTrackIds: new Set<string>(),
});

interface MusicStore {
  // 播放状态（全局，因为播放器是共享的）
  playback: PlaybackState;
  // 按 sessionId 存储的数据
  sessions: Record<string, SessionMusicData>;
  // 当前活跃的 sessionId
  activeSessionId: string | null;
  // 音乐面板展开状态
  showExpandedPanel: boolean;

  // 初始化 Session
  initSession: (sessionId: string) => void;
  // 切换活跃 Session
  setActiveSession: (sessionId: string) => void;
  // 获取当前 Session 数据
  getCurrent: () => SessionMusicData;

  // 播放状态操作（全局）
  setPlayback: (state: PlaybackState) => void;

  // Session 数据操作
  setRecommendation: (sessionId: string, rec: MusicRecommendation) => void;
  setMode: (sessionId: string, mode: MusicMode) => void;
  setQueue: (sessionId: string, tracks: MusicTrack[]) => void;
  setCurrentIndex: (sessionId: string, index: number) => void;
  nextTrack: (sessionId: string) => void;
  previousTrack: (sessionId: string) => void;
  clearSession: (sessionId: string) => void;

  // 已播放歌曲管理（用于去重推荐）
  addPlayedTrack: (sessionId: string, trackId: string) => void;
  addPlayedTracks: (sessionId: string, trackIds: string[]) => void;
  getPlayedTrackIds: (sessionId: string) => string[];
  clearPlayedTracks: (sessionId: string) => void;

  // 音乐面板展开控制
  setShowExpandedPanel: (show: boolean) => void;
}

export const useMusicStore = create<MusicStore>((set, get) => ({
  playback: {
    status: 'stopped',
    volume: 30,
  },
  sessions: {},
  activeSessionId: null,
  showExpandedPanel: false,

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

  setPlayback: (state) => set({ playback: state }),

  setRecommendation: (sessionId, rec) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    set({
      sessions: {
        ...sessions,
        [sessionId]: {
          ...sessionData,
          recommendation: rec,
          queue: rec.tracks,
          currentIndex: 0,
          mode: rec.mode,
        },
      },
    });
  },

  setMode: (sessionId, mode) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...sessionData, mode },
      },
    });
  },

  setQueue: (sessionId, tracks) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...sessionData, queue: tracks, currentIndex: 0 },
      },
    });
  },

  setCurrentIndex: (sessionId, index) => {
    const { sessions } = get();
    const sessionData = sessions[sessionId];
    if (!sessionData) return;
    if (index < 0 || index >= sessionData.queue.length) return;
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...sessionData, currentIndex: index },
      },
    });
  },

  nextTrack: (sessionId) => {
    const { sessions } = get();
    const sessionData = sessions[sessionId];
    if (!sessionData || sessionData.queue.length === 0) return;
    const nextIndex = (sessionData.currentIndex + 1) % sessionData.queue.length;
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...sessionData, currentIndex: nextIndex },
      },
    });
  },

  previousTrack: (sessionId) => {
    const { sessions } = get();
    const sessionData = sessions[sessionId];
    if (!sessionData || sessionData.queue.length === 0) return;
    const prevIndex = sessionData.currentIndex === 0 ? sessionData.queue.length - 1 : sessionData.currentIndex - 1;
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...sessionData, currentIndex: prevIndex },
      },
    });
  },

  clearSession: (sessionId) => {
    const { sessions } = get();
    const { [sessionId]: _, ...rest } = sessions;
    set({ sessions: rest });
  },

  // 已播放歌曲管理（用于去重推荐）
  addPlayedTrack: (sessionId, trackId) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    const newPlayedTrackIds = new Set(sessionData.playedTrackIds);
    newPlayedTrackIds.add(trackId);
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...sessionData, playedTrackIds: newPlayedTrackIds },
      },
    });
  },

  addPlayedTracks: (sessionId, trackIds) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    const newPlayedTrackIds = new Set(sessionData.playedTrackIds);
    trackIds.forEach(id => newPlayedTrackIds.add(id));
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...sessionData, playedTrackIds: newPlayedTrackIds },
      },
    });
  },

  getPlayedTrackIds: (sessionId) => {
    const { sessions } = get();
    const sessionData = sessions[sessionId];
    if (!sessionData) return [];
    return Array.from(sessionData.playedTrackIds);
  },

  clearPlayedTracks: (sessionId) => {
    const { sessions, initSession } = get();
    if (!sessions[sessionId]) initSession(sessionId);
    const sessionData = sessions[sessionId] || defaultSessionData();
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...sessionData, playedTrackIds: new Set<string>() },
      },
    });
  },

  setShowExpandedPanel: (show) => set({ showExpandedPanel: show }),
}));
