import { useState } from 'react';
import type { UserManualState, CodingMoodState } from '@music-coding/shared-types';
import { useContextStore } from '@/stores/contextStore';
import { useUIAtmosphereStore } from '@/stores/uiAtmosphereStore';
import { fetchRecommendation, autoPlayRecommendation } from '@/clients/musicClient';
import { IconChevronDown, IconChevronRight } from '@/components/common/Icons';
import { moodOptions } from '@/config/moodOptions';
import s from '@/styles/layout.module.css';
import { SIDECAR_BASE } from '@/config';
const STORAGE_KEY = 'music-coding-manual-state';

// 加载缓存的手动状态
export function loadManualState(): UserManualState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const state = JSON.parse(stored) as UserManualState;
      useContextStore.getState().setManualState(state);
      return state;
    }
  } catch {}
  return null;
}

// 保存手动状态
function saveManualState(state: UserManualState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function ManualStateSelector() {
  const [expanded, setExpanded] = useState(false);
  const manualState = useContextStore((st) => st.context.manualState);
  const setManualState = useContextStore((st) => st.setManualState);

  // 获取当前选中的选项
  const currentOption = moodOptions.find(o => o.value === manualState) || moodOptions[0];

  const handleChange = async (state: UserManualState, mood: CodingMoodState) => {
    setManualState(state);
    saveManualState(state);
    setExpanded(false); // 选择后收起

    // 立即更新氛围层，不等推荐结果，用户切换时即时感知
    useUIAtmosphereStore.getState().setMood(mood);

    try {
      await fetch(`${SIDECAR_BASE}/context/manual-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
    } catch (e) {
      // 同步失败，静默处理
    }
    // 切换状态时，混入每日推荐（个性化）
    const rec = await fetchRecommendation(mood, true, true);
    if (rec && rec.tracks.length > 0) {
      await autoPlayRecommendation();
    }
  };

  return (
    <div>
      <div className={s.rightSectionTitle}>手动状态</div>
      {/* 当前状态 - 点击展开 */}
      <button
        className={s.stateCurrentBtn}
        onClick={() => setExpanded(!expanded)}
      >
        <span className={s.stateCurrentIcon}>{currentOption.icon(14)}</span>
        <span className={s.stateCurrentLabel}>{currentOption.label}</span>
        <span className={s.stateCurrentArrow}>
          {expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
        </span>
      </button>
      {/* 展开的所有选项 */}
      {expanded && (
        <div className={s.stateSelector}>
          {moodOptions.map(({ value, label, icon, mood, desc }) => (
            <button
              key={label}
              className={`${s.stateBtn} ${manualState === value ? s.stateBtnActive : ''}`}
              onClick={() => handleChange(value, mood)}
              title={desc}
            >
              <span className={s.stateBtnIcon}>{icon(14)}</span>
              <span className={s.stateBtnLabel}>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
