import { create } from 'zustand';
import type { CodingMoodState, MusicAtmosphere } from '@music-coding/shared-types';
import { atmosphereMap } from '@music-coding/ui-tokens';

interface UIAtmosphereStore {
  currentMood: CodingMoodState;
  glowColor: string;
  animationLevel: 'none' | 'subtle' | 'active';
  waveSpeed: 'static' | 'slow' | 'medium' | 'fast';
  setMood: (mood: CodingMoodState, atmosphere?: MusicAtmosphere) => void;
}

export const useUIAtmosphereStore = create<UIAtmosphereStore>((set) => ({
  currentMood: 'neutral',
  glowColor: 'rgba(255,255,255,0.08)',
  animationLevel: 'subtle',
  waveSpeed: 'slow',

  setMood: (mood, atmosphere) => {
    const config = atmosphereMap[mood] || atmosphereMap.neutral;
    set({
      currentMood: mood,
      glowColor: atmosphere?.colors.edgeGlow || config.glowColor,
      animationLevel: atmosphere?.animationLevel || config.animationLevel,
      waveSpeed: config.waveSpeed,
    });
  },
}));
