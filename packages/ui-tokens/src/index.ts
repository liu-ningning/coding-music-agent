import type { CodingMoodState } from '@music-coding/shared-types';

// ── 设计 Token ──

export const tokens = {
  color: {
    // 背景层
    bgBase: '#111111',
    bgPanel: '#1A1A1A',
    bgElevated: 'rgba(255,255,255,0.06)',
    bgOverlay: 'rgba(0,0,0,0.6)',

    // 边框
    borderSubtle: 'rgba(255,255,255,0.08)',
    borderActive: 'rgba(255,255,255,0.15)',

    // 文字
    textPrimary: 'rgba(255,255,255,0.92)',
    textSecondary: 'rgba(255,255,255,0.62)',
    textMuted: 'rgba(255,255,255,0.38)',
    textDisabled: 'rgba(255,255,255,0.2)',

    // 状态色（低饱和）
    accentFeature: '#58A6A6',
    accentDebug: '#6F8FAF',
    accentRefactor: '#7E6FB5',
    accentReview: '#7A8B9A',
    accentEmergency: '#B56B6B',
    accentLowEnergy: '#9A8BAF',
    accentLateNight: '#4A5A7A',

    // 语义色
    success: '#5A9E6F',
    warning: '#B5A36B',
    error: '#B56B6B',
    info: '#6B8FB5',
  },

  radius: {
    sm: 6,
    md: 10,
    lg: 16,
    xl: 24,
    full: 9999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },

  motion: {
    instant: 80,
    fast: 150,
    normal: 250,
    slow: 400,
    atmosphere: 900,
    easeOut: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    easeInOut: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  typography: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
    xs: 11,
    sm: 12,
    base: 13,
    md: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
  },

  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.3)',
    md: '0 4px 12px rgba(0,0,0,0.4)',
    lg: '0 8px 24px rgba(0,0,0,0.5)',
    glow: '0 0 20px rgba(100,140,200,0.1)',
  },
} as const;

// ── CodingMoodState → 颜色映射 ──

export const moodColorMap: Record<CodingMoodState, string> = {
  feature_flow: tokens.color.accentFeature,
  debug_calm: tokens.color.accentDebug,
  deep_refactor: tokens.color.accentRefactor,
  review_focus: tokens.color.accentReview,
  emergency_focus: tokens.color.accentEmergency,
  low_energy: tokens.color.accentLowEnergy,
  late_night_flow: tokens.color.accentLateNight,
  recovery_mode: tokens.color.accentFeature,
  neutral: tokens.color.textMuted,
};

// ── CodingMoodState → 氛围配置 ──

export interface AtmosphereConfig {
  glowColor: string;
  animationLevel: 'none' | 'subtle' | 'active';
  waveSpeed: 'static' | 'slow' | 'medium' | 'fast';
}

export const atmosphereMap: Record<CodingMoodState, AtmosphereConfig> = {
  feature_flow: {
    glowColor: '#58A6A6',
    animationLevel: 'active',
    waveSpeed: 'medium',
  },
  debug_calm: {
    glowColor: '#6F8FAF',
    animationLevel: 'subtle',
    waveSpeed: 'slow',
  },
  deep_refactor: {
    glowColor: '#7E6FB5',
    animationLevel: 'subtle',
    waveSpeed: 'slow',
  },
  review_focus: {
    glowColor: '#7A8B9A',
    animationLevel: 'subtle',
    waveSpeed: 'slow',
  },
  emergency_focus: {
    glowColor: '#B56B6B',
    animationLevel: 'subtle',
    waveSpeed: 'static',
  },
  low_energy: {
    glowColor: '#9A8BAF',
    animationLevel: 'subtle',
    waveSpeed: 'slow',
  },
  late_night_flow: {
    glowColor: '#4A5A7A',
    animationLevel: 'subtle',
    waveSpeed: 'slow',
  },
  recovery_mode: {
    glowColor: '#58A6A6',
    animationLevel: 'subtle',
    waveSpeed: 'slow',
  },
  neutral: {
    glowColor: 'rgba(255,255,255,0.08)',
    animationLevel: 'subtle',
    waveSpeed: 'slow',
  },
};

// ── CSS Variables 生成 ──

export function generateCSSVariables(): string {
  return `
:root {
  --color-bg-base: ${tokens.color.bgBase};
  --color-bg-panel: ${tokens.color.bgPanel};
  --color-bg-elevated: ${tokens.color.bgElevated};
  --color-bg-overlay: ${tokens.color.bgOverlay};
  --color-border-subtle: ${tokens.color.borderSubtle};
  --color-border-active: ${tokens.color.borderActive};
  --color-text-primary: ${tokens.color.textPrimary};
  --color-text-secondary: ${tokens.color.textSecondary};
  --color-text-muted: ${tokens.color.textMuted};
  --color-text-disabled: ${tokens.color.textDisabled};
  --color-accent-feature: ${tokens.color.accentFeature};
  --color-accent-debug: ${tokens.color.accentDebug};
  --color-accent-refactor: ${tokens.color.accentRefactor};
  --color-accent-review: ${tokens.color.accentReview};
  --color-accent-emergency: ${tokens.color.accentEmergency};
  --color-accent-low-energy: ${tokens.color.accentLowEnergy};
  --color-accent-late-night: ${tokens.color.accentLateNight};
  --color-success: ${tokens.color.success};
  --color-warning: ${tokens.color.warning};
  --color-error: ${tokens.color.error};
  --color-info: ${tokens.color.info};
  --radius-sm: ${tokens.radius.sm}px;
  --radius-md: ${tokens.radius.md}px;
  --radius-lg: ${tokens.radius.lg}px;
  --radius-xl: ${tokens.radius.xl}px;
  --motion-instant: ${tokens.motion.instant}ms;
  --motion-fast: ${tokens.motion.fast}ms;
  --motion-normal: ${tokens.motion.normal}ms;
  --motion-slow: ${tokens.motion.slow}ms;
  --motion-atmosphere: ${tokens.motion.atmosphere}ms;
  --font-sans: ${tokens.typography.sans};
  --font-mono: ${tokens.typography.mono};
}
`.trim();
}
