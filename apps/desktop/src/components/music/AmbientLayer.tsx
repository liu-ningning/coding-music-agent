import { useUIAtmosphereStore } from '@/stores/uiAtmosphereStore';
import { useMusicStore } from '@/stores/musicStore';
import { withAlpha } from '@/utils/colorUtils';
import s from '@/styles/layout.module.css';

export function AmbientLayer() {
  const glow = useUIAtmosphereStore((st) => st.glowColor);
  const anim = useUIAtmosphereStore((st) => st.animationLevel);
  const mood = useUIAtmosphereStore((st) => st.currentMood);
  const playing = useMusicStore((st) => st.playback.status) === 'playing';

  // 氛围层可见性基于 mood 状态，不依赖播放状态
  const active = mood !== 'neutral' && anim !== 'none';
  const op = active ? (playing ? 0.8 : 0.5) : 0.15;

  return (
    <div className={s.ambientLayer}>
      <div className={s.ambientGlow} style={{ background: `radial-gradient(ellipse at 50% 0%, ${withAlpha(glow, '15')} 0%, transparent 60%)`, opacity: op }} />
      <div className={s.ambientEdgeTop} style={{ background: `linear-gradient(90deg, transparent, ${withAlpha(glow, '40')}, transparent)`, opacity: active ? (playing ? 1 : 0.6) : 0.1 }} />
      <div className={s.ambientEdgeLeft} style={{ background: `linear-gradient(180deg, transparent, ${withAlpha(glow, '20')}, transparent)`, opacity: active ? (playing ? 0.6 : 0.35) : 0.05 }} />
      <div className={s.ambientEdgeRight} style={{ background: `linear-gradient(180deg, transparent, ${withAlpha(glow, '20')}, transparent)`, opacity: active ? (playing ? 0.6 : 0.35) : 0.05 }} />
      <div className={s.ambientEdgeBottom} style={{ background: `linear-gradient(90deg, transparent, ${withAlpha(glow, '30')}, transparent)`, opacity: active ? (playing ? 0.8 : 0.5) : 0.08 }} />
    </div>
  );
}
