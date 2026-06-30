import { useState, useEffect, useRef } from 'react';
import type { UserManualState, CodingMoodState } from '@music-coding/shared-types';
import { useSessionStore } from '@/stores/sessionStore';
import { useContextStore } from '@/stores/contextStore';
import { useUIAtmosphereStore } from '@/stores/uiAtmosphereStore';
import { fetchRecommendation, autoPlayRecommendation } from '@/clients/musicClient';
import { moodOptions } from '@/config/moodOptions';
import { SIDECAR_BASE } from '@/config';
import s from '@/styles/layout.module.css';

const STORAGE_KEY = 'music-coding-manual-state';

export function TopStrip() {
  const [time, setTime] = useState(() => new Date());
  const [showMoodSelector, setShowMoodSelector] = useState(false);
  const moodRef = useRef<HTMLDivElement>(null);
  const sessionId = useSessionStore((st) => st.current?.id);
  const manualState = useContextStore((st) => st.context.manualState);
  const setManualState = useContextStore((st) => st.setManualState);

  // 实时时钟，每秒更新
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 点击外部关闭 mood 选择器
  useEffect(() => {
    if (!showMoodSelector) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moodRef.current && !moodRef.current.contains(e.target as Node)) {
        setShowMoodSelector(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClickOutside); };
  }, [showMoodSelector]);

  const timeStr = time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const currentMoodOpt = moodOptions.find(o => o.value === manualState) || moodOptions[0];

  const handleMoodChange = async (state: UserManualState, mood: CodingMoodState) => {
    setManualState(state);
    setShowMoodSelector(false);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    useUIAtmosphereStore.getState().setMood(mood);
    try {
      await fetch(`${SIDECAR_BASE}/context/manual-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
    } catch {}
    const rec = await fetchRecommendation(mood, true);
    if (rec && rec.tracks.length > 0) await autoPlayRecommendation();
  };

  return (
    <div className={s.topStrip}>
      {/* 快捷状态切换 */}
      <div className={s.topStripMoodWrap} ref={moodRef}>
        <button
          className={s.topStripMoodBtn}
          onClick={() => setShowMoodSelector(!showMoodSelector)}
          title="点击切换状态"
        >
          {currentMoodOpt.icon(12)}
          <span>{currentMoodOpt.label}</span>
        </button>
        {showMoodSelector && (
          <div className={s.topStripMoodPopup}>
            <div className={s.stateSelector}>
              {moodOptions.map(({ value, label, mood, icon, desc }) => (
                <button
                  key={label}
                  className={`${s.stateBtn} ${manualState === value ? s.stateBtnActive : ''}`}
                  onClick={() => handleMoodChange(value, mood)}
                  title={desc}
                >
                  <span className={s.stateBtnIcon}>{icon(12)}</span>
                  <span className={s.stateBtnLabel}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <span className={s.topStripTime}>{timeStr}</span>
    </div>
  );
}
