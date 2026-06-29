import { describe, it, expect, beforeEach } from 'vitest';
import { useUIAtmosphereStore } from '../uiAtmosphereStore';

describe('uiAtmosphereStore', () => {
  beforeEach(() => {
    // 重置为默认值
    useUIAtmosphereStore.setState({
      currentMood: 'neutral',
      glowColor: 'rgba(255,255,255,0.08)',
      animationLevel: 'subtle',
      waveSpeed: 'slow',
    });
  });

  it('应该有正确的默认值', () => {
    const state = useUIAtmosphereStore.getState();
    expect(state.currentMood).toBe('neutral');
    expect(state.glowColor).toBe('rgba(255,255,255,0.08)');
    expect(state.animationLevel).toBe('subtle');
    expect(state.waveSpeed).toBe('slow');
  });

  it('setMood 应该使用 atmosphereMap 中的配置作为 fallback', () => {
    useUIAtmosphereStore.getState().setMood('feature_flow');

    const state = useUIAtmosphereStore.getState();
    expect(state.currentMood).toBe('feature_flow');
    expect(state.glowColor).toBe('#58A6A6');
    expect(state.animationLevel).toBe('active');
    expect(state.waveSpeed).toBe('medium');
  });

  it('setMood 应该优先使用 atmosphere 参数中的颜色', () => {
    const atmosphere = {
      id: 'atm_test',
      label: '测试',
      mood: 'debug_calm' as const,
      intensity: 'low' as const,
      distractionLevel: 'minimal' as const,
      animationLevel: 'subtle' as const,
      colors: {
        backgroundGradient: 'linear-gradient(135deg, #111 0%, #6F8FAF22 100%)',
        edgeGlow: '#AABBCC',
        accent: '#AABBCC',
      },
    };

    useUIAtmosphereStore.getState().setMood('debug_calm', atmosphere);

    const state = useUIAtmosphereStore.getState();
    expect(state.currentMood).toBe('debug_calm');
    // edgeGlow 覆盖了 atmosphereMap 中的 glowColor
    expect(state.glowColor).toBe('#AABBCC');
    // animationLevel 来自 atmosphere 参数
    expect(state.animationLevel).toBe('subtle');
    // waveSpeed 仍来自 atmosphereMap（atmosphere 参数中无此字段）
    expect(state.waveSpeed).toBe('slow');
  });

  it('setMood 应该正确设置所有 mood 状态', () => {
    const moods = [
      'feature_flow',
      'debug_calm',
      'deep_refactor',
      'review_focus',
      'emergency_focus',
      'low_energy',
      'late_night_flow',
      'recovery_mode',
      'neutral',
    ] as const;

    for (const mood of moods) {
      useUIAtmosphereStore.getState().setMood(mood);
      expect(useUIAtmosphereStore.getState().currentMood).toBe(mood);
    }
  });

  it('emergency_focus 应该有 subtle 动画级别（非 none）', () => {
    useUIAtmosphereStore.getState().setMood('emergency_focus');

    const state = useUIAtmosphereStore.getState();
    expect(state.animationLevel).toBe('subtle');
    expect(state.glowColor).toBe('#B56B6B');
  });

  it('setMood 对未知 mood 应 fallback 到 neutral 配置', () => {
    useUIAtmosphereStore.getState().setMood('unknown_mood' as any);

    const state = useUIAtmosphereStore.getState();
    expect(state.currentMood).toBe('unknown_mood');
    // fallback 到 atmosphereMap.neutral
    expect(state.glowColor).toBe('rgba(255,255,255,0.08)');
    expect(state.animationLevel).toBe('subtle');
    expect(state.waveSpeed).toBe('slow');
  });
});
