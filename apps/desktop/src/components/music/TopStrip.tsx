import { useState, useEffect, useRef } from 'react';
import type { UserManualState, CodingMoodState } from '@music-coding/shared-types';
import { useSessionStore } from '@/stores/sessionStore';
import { useContextStore } from '@/stores/contextStore';
import { useUIAtmosphereStore } from '@/stores/uiAtmosphereStore';
import { fetchRecommendation, autoPlayRecommendation } from '@/clients/musicClient';
import { IconAuto, IconTarget, IconBrain, IconCreative, IconWrench, IconBook, IconEnergy, IconNight, IconCity, IconWave, IconAlert } from '@/components/common/Icons';
import { SIDECAR_BASE } from '@/config';
import s from '@/styles/layout.module.css';

const STORAGE_KEY = 'music-coding-manual-state';

interface MoodOption {
  value: UserManualState;
  label: string;
  mood: CodingMoodState;
  icon: React.ReactNode;
}

const moodOpts: MoodOption[] = [
  { value: null, label: '自动', mood: 'neutral', icon: <IconAuto size={12} /> },
  { value: 'need_focus', label: '专注', mood: 'feature_flow', icon: <IconTarget size={12} /> },
  { value: 'deep_work', label: '深度', mood: 'deep_refactor', icon: <IconBrain size={12} /> },
  { value: 'debugging', label: '调试', mood: 'debug_calm', icon: <IconWrench size={12} /> },
  { value: 'reading', label: '阅读', mood: 'review_focus', icon: <IconBook size={12} /> },
  { value: 'need_energy', label: '提神', mood: 'feature_flow', icon: <IconEnergy size={12} /> },
  { value: 'need_relax', label: '放松', mood: 'low_energy', icon: <IconNight size={12} /> },
  { value: 'late_night', label: '深夜', mood: 'late_night_flow', icon: <IconCity size={12} /> },
  { value: 'emergency', label: '紧急', mood: 'emergency_focus', icon: <IconAlert size={12} /> },
];

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
  const currentMoodOpt = moodOpts.find(o => o.value === manualState) || moodOpts[0];

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
          {currentMoodOpt.icon}
          <span>{currentMoodOpt.label}</span>
        </button>
        {showMoodSelector && (
          <div className={s.topStripMoodPopup}>
            {moodOpts.map(({ value, label, mood, icon }) => (
              <button
                key={label}
                className={`${s.topStripMoodItem} ${manualState === value ? s.topStripMoodItemActive : ''}`}
                onClick={() => handleMoodChange(value, mood)}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <span className={s.topStripTime}>{timeStr}</span>
    </div>
  );
}
