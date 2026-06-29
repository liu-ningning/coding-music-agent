import { useState, useEffect } from 'react';
import { useMusicStore } from '@/stores/musicStore';
import { useSessionStore } from '@/stores/sessionStore';
import s from '@/styles/layout.module.css';

export function TopStrip() {
  const [time, setTime] = useState(() => new Date());
  const playback = useMusicStore((st) => st.playback);
  const sessionId = useSessionStore((st) => st.current?.id);

  const sessionData = useMusicStore((st) => {
    if (!sessionId) return null;
    return st.sessions[sessionId] || null;
  });

  // 实时时钟，每秒更新
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const playing = playback.status === 'playing';
  const timeStr = time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className={s.topStrip}>
      <div className={s.topStripWave}>
        {[6, 10, 4, 8, 6].map((h, i) => (
          <div
            key={i}
            className={`${s.topStripWaveBar} ${playing ? s.topStripWaveBarPlaying : ''}`}
            style={{
              height: h,
              opacity: playing ? 0.9 : 0.5,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <span className={s.topStripTime}>{timeStr}</span>
    </div>
  );
}
