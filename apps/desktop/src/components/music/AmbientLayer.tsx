import { useUIAtmosphereStore } from '@/stores/uiAtmosphereStore';
import { useMusicStore } from '@/stores/musicStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { withAlpha } from '@/utils/colorUtils';
import s from '@/styles/layout.module.css';

// 氛围强度对应的透明度倍率
const INTENSITY_MULTIPLIER = { low: 0.4, medium: 1, high: 1.5 };

export function AmbientLayer() {
  const glow = useUIAtmosphereStore((st) => st.glowColor);
  const anim = useUIAtmosphereStore((st) => st.animationLevel);
  const mood = useUIAtmosphereStore((st) => st.currentMood);
  const playing = useMusicStore((st) => st.playback.status) === 'playing';
  const intensity = useSettingsStore((st) => st.atmosphereIntensity);

  // 氛围强度倍率
  const multiplier = INTENSITY_MULTIPLIER[intensity];

  // low 强度下完全关闭氛围层
  if (intensity === 'low' && mood === 'neutral') {
    return <div className={s.ambientLayer} style={{ opacity: 0 }} />;
  }

  // 氛围层可见性基于 mood 状态，不依赖播放状态
  const active = mood !== 'neutral' && anim !== 'none';
  const baseOp = active ? (playing ? 0.8 : 0.5) : 0.15;
  const op = Math.min(1, baseOp * multiplier);

  return (
    <div className={s.ambientLayer}>
      <div className={s.ambientGlow} style={{ background: `radial-gradient(ellipse at 50% 0%, ${withAlpha(glow, '15')} 0%, transparent 60%)`, opacity: op }} />
      <div className={s.ambientEdgeTop} style={{ background: `linear-gradient(90deg, transparent, ${withAlpha(glow, '40')}, transparent)`, opacity: Math.min(1, (active ? (playing ? 1 : 0.6) : 0.1) * multiplier) }} />
      <div className={s.ambientEdgeLeft} style={{ background: `linear-gradient(180deg, transparent, ${withAlpha(glow, '20')}, transparent)`, opacity: Math.min(1, (active ? (playing ? 0.6 : 0.35) : 0.05) * multiplier) }} />
      <div className={s.ambientEdgeRight} style={{ background: `linear-gradient(180deg, transparent, ${withAlpha(glow, '20')}, transparent)`, opacity: Math.min(1, (active ? (playing ? 0.6 : 0.35) : 0.05) * multiplier) }} />
      <div className={s.ambientEdgeBottom} style={{ background: `linear-gradient(90deg, transparent, ${withAlpha(glow, '30')}, transparent)`, opacity: Math.min(1, (active ? (playing ? 0.8 : 0.5) : 0.08) * multiplier) }} />
    </div>
  );
}
