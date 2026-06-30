import { create } from 'zustand';

const STORAGE_KEY = 'music-coding-settings';

export type AtmosphereIntensity = 'low' | 'medium' | 'high';

interface SettingsData {
  reducedMotion: boolean;
  volume: number;
  autoRecommend: boolean;
  showFloatingCard: boolean;
  showDebug: boolean;
  atmosphereIntensity: AtmosphereIntensity;
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
  setAtmosphereIntensity: (value: AtmosphereIntensity) => void;
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
  atmosphereIntensity: 'medium',
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
      saveToStorage({ ...get(), reducedMotion: value });
    },

    setVolume: (value) => {
      set({ volume: value });
      saveToStorage({ ...get(), volume: value });
    },

    setAutoRecommend: (value) => {
      set({ autoRecommend: value });
      saveToStorage({ ...get(), autoRecommend: value });
    },

    setShowFloatingCard: (value) => {
      set({ showFloatingCard: value });
      saveToStorage({ ...get(), showFloatingCard: value });
    },

    setShowDebug: (value) => {
      set({ showDebug: value });
      saveToStorage({ ...get(), showDebug: value });
    },

    setAtmosphereIntensity: (value) => {
      set({ atmosphereIntensity: value });
      saveToStorage({ ...get(), atmosphereIntensity: value });
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
