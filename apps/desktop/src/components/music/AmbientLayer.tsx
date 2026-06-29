import { useUIAtmosphereStore } from '@/stores/uiAtmosphereStore';
import { useMusicStore } from '@/stores/musicStore';
import s from '@/styles/layout.module.css';

export function AmbientLayer() {
  const glow = useUIAtmosphereStore((st) => st.glowColor);
  const anim = useUIAtmosphereStore((st) => st.animationLevel);
  const playing = useMusicStore((st) => st.playback.status) === 'playing';
  const show = anim !== 'none' && playing;
  const op = show ? 0.8 : 0.3;

  return (
    <div className={s.ambientLayer}>
      <div className={s.ambientGlow} style={{ background: `radial-gradient(ellipse at 50% 0%, ${glow}15 0%, transparent 60%)`, opacity: op }} />
      <div className={s.ambientEdgeTop} style={{ background: `linear-gradient(90deg, transparent, ${glow}40, transparent)`, opacity: show ? 1 : 0.2 }} />
      <div className={s.ambientEdgeLeft} style={{ background: `linear-gradient(180deg, transparent, ${glow}20, transparent)`, opacity: show ? 0.6 : 0.1 }} />
      <div className={s.ambientEdgeRight} style={{ background: `linear-gradient(180deg, transparent, ${glow}20, transparent)`, opacity: show ? 0.6 : 0.1 }} />
      <div className={s.ambientEdgeBottom} style={{ background: `linear-gradient(90deg, transparent, ${glow}30, transparent)`, opacity: show ? 0.8 : 0.15 }} />
    </div>
  );
}
