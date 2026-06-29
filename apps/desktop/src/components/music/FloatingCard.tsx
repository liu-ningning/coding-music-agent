import { useState, useRef, useCallback, useEffect } from 'react';
import { useMusicStore } from '@/stores/musicStore';
import { useSessionStore } from '@/stores/sessionStore';
import { audioPlayer } from '@/clients/audioPlayer';
import { ExpandedPanel } from './ExpandedPanel';
import s from '@/styles/layout.module.css';

export function FloatingCard() {
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const hasMovedRef = useRef(false);
  const playback = useMusicStore((st) => st.playback);
  const sessionId = useSessionStore((st) => st.current?.id);

  const sessionData = useMusicStore((st) => {
    if (!sessionId) return null;
    return st.sessions[sessionId] || null;
  });

  const rec = sessionData?.recommendation || null;
  const playing = playback.status === 'playing';
  const track = playback.currentTrack;
  const label = rec?.atmosphere.label || 'Music';

  // 初始化位置（右下角）
  useEffect(() => {
    setPosition({
      x: window.innerWidth - 50,
      y: window.innerHeight - 110,
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMovedRef.current = true;
      }

      const newX = Math.max(0, Math.min(window.innerWidth - 40, dragStartRef.current.posX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 40, dragStartRef.current.posY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleClick = useCallback(() => {
    if (!hasMovedRef.current) {
      setExpanded(true);
    }
  }, []);

  if (expanded) return <ExpandedPanel onClose={() => setExpanded(false)} />;

  return (
    <div
      className={s.floatingBtn}
      style={{ right: 'auto', bottom: 'auto', left: position.x, top: position.y }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      title={track ? `${track.title} - ${track.artists.join(', ')}` : label}
    >
      {/* 音乐动画图标 */}
      <div className={s.floatingBtnWave}>
        {[6, 10, 4, 8, 6].map((h, i) => (
          <div
            key={i}
            className={`${s.floatingBtnWaveBar} ${playing ? s.floatingBtnWaveBarPlaying : ''}`}
            style={{
              height: h,
              opacity: playing ? 0.9 : 0.5,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
