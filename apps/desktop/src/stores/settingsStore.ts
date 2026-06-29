import { create } from 'zustand';

const STORAGE_KEY = 'music-coding-settings';

interface SettingsData {
  reducedMotion: boolean;
  volume: number;
  autoRecommend: boolean;
  showFloatingCard: boolean;
  showDebug: boolean;
}

interface SettingsStore extends SettingsData {
  // UI 状态（不持久化）
  settingsOpen: boolean;
  permissionsOpen: boolean;

  // Actions
  setReducedMotion: (value: boolean) => void;
  setVolume: (value: number) => void;
  setAutoRecommend: (value: boolean) => void;
  setShowFloatingCard: (value: boolean) => void;
  setShowDebug: (value: boolean) => void;
  toggleSettings: () => void;
  togglePermissions: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openPermissions: () => void;
  closePermissions: () => void;
  loadSettings: () => void;
}

// 从 localStorage 加载设置
function loadFromStorage(): Partial<SettingsData> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

// 保存设置到 localStorage
function saveToStorage(data: SettingsData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

// 默认值
const defaults: SettingsData = {
  reducedMotion: false,
  volume: 30,
  autoRecommend: true,
  showFloatingCard: true,
  showDebug: false,
};

export const useSettingsStore = create<SettingsStore>((set, get) => {
  // 初始化时加载存储的设置
  const stored = loadFromStorage();
  // 兼容旧字段名
  if ('showAudioDebug' in stored && !('showDebug' in stored)) {
    (stored as Record<string, unknown>).showDebug = (stored as Record<string, unknown>).showAudioDebug;
    delete (stored as Record<string, unknown>).showAudioDebug;
  }
  const initial = { ...defaults, ...stored };

  return {
    ...initial,
    settingsOpen: false,
    permissionsOpen: false,

    setReducedMotion: (value) => {
      set({ reducedMotion: value });
      const { volume, autoRecommend, showFloatingCard, showDebug } = get();
      saveToStorage({ reducedMotion: value, volume, autoRecommend, showFloatingCard, showDebug });
    },

    setVolume: (value) => {
      set({ volume: value });
      const { reducedMotion, autoRecommend, showFloatingCard, showDebug } = get();
      saveToStorage({ reducedMotion, volume: value, autoRecommend, showFloatingCard, showDebug });
    },

    setAutoRecommend: (value) => {
      set({ autoRecommend: value });
      const { reducedMotion, volume, showFloatingCard, showDebug } = get();
      saveToStorage({ reducedMotion, volume, autoRecommend: value, showFloatingCard, showDebug });
    },

    setShowFloatingCard: (value) => {
      set({ showFloatingCard: value });
      const { reducedMotion, volume, autoRecommend, showDebug } = get();
      saveToStorage({ reducedMotion, volume, autoRecommend, showFloatingCard: value, showDebug });
    },

    setShowDebug: (value) => {
      set({ showDebug: value });
      const { reducedMotion, volume, autoRecommend, showFloatingCard } = get();
      saveToStorage({ reducedMotion, volume, autoRecommend, showFloatingCard, showDebug: value });
    },

    toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen, permissionsOpen: false })),
    togglePermissions: () => set((s) => ({ permissionsOpen: !s.permissionsOpen, settingsOpen: false })),
    openSettings: () => set({ settingsOpen: true, permissionsOpen: false }),
    closeSettings: () => set({ settingsOpen: false }),
    openPermissions: () => set({ permissionsOpen: true, settingsOpen: false }),
    closePermissions: () => set({ permissionsOpen: false }),

    loadSettings: () => {
      const stored = loadFromStorage();
      if ('showAudioDebug' in stored && !('showDebug' in stored)) {
        (stored as Record<string, unknown>).showDebug = (stored as Record<string, unknown>).showAudioDebug;
        delete (stored as Record<string, unknown>).showAudioDebug;
      }
      set({ ...defaults, ...stored });
    },
  };
});
