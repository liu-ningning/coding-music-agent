import { useState } from 'react';
import type { UserManualState, CodingMoodState } from '@music-coding/shared-types';
import { useContextStore } from '@/stores/contextStore';
import { fetchRecommendation, autoPlayRecommendation } from '@/clients/musicClient';
import { IconAuto, IconTarget, IconBrain, IconCreative, IconWrench, IconBook, IconEnergy, IconNight, IconCity, IconWave, IconAlert, IconChevronDown, IconChevronRight } from '@/components/common/Icons';
import s from '@/styles/layout.module.css';
import { SIDECAR_BASE } from '@/config';
const STORAGE_KEY = 'music-coding-manual-state';

interface StateOption {
  value: UserManualState;
  label: string;
  desc: string;
  mood: CodingMoodState;
  icon: React.ReactNode;
}

const opts: StateOption[] = [
  { value: null, label: '自动', desc: '系统自动判断', mood: 'neutral', icon: <IconAuto size={14} /> },
  { value: 'need_focus', label: '专注', desc: '中 BPM，有节奏感', mood: 'feature_flow', icon: <IconTarget size={14} /> },
  { value: 'deep_work', label: '深度工作', desc: '低打扰，沉浸式', mood: 'deep_refactor', icon: <IconBrain size={14} /> },
  { value: 'creative', label: '创意', desc: '轻松活力，灵感激发', mood: 'feature_flow', icon: <IconCreative size={14} /> },
  { value: 'debugging', label: '调试', desc: '平静稳定，保持冷静', mood: 'debug_calm', icon: <IconWrench size={14} /> },
  { value: 'reading', label: '阅读', desc: '极低干扰，纯背景', mood: 'review_focus', icon: <IconBook size={14} /> },
  { value: 'need_energy', label: '提神', desc: '活力节奏，提振精神', mood: 'feature_flow', icon: <IconEnergy size={14} /> },
  { value: 'need_relax', label: '放松', desc: '温柔舒缓，缓解压力', mood: 'low_energy', icon: <IconNight size={14} /> },
  { value: 'low_state', label: '低状态', desc: '温和陪伴，慢慢恢复', mood: 'low_energy', icon: <IconNight size={14} /> },
  { value: 'late_night', label: '深夜', desc: '深色氛围，低打扰', mood: 'late_night_flow', icon: <IconCity size={14} /> },
  { value: 'background', label: '纯背景', desc: '白噪音，最小干扰', mood: 'review_focus', icon: <IconWave size={14} /> },
  { value: 'emergency', label: '紧急', desc: '极低干扰或暂停', mood: 'emergency_focus', icon: <IconAlert size={14} /> },
];

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
  const currentOption = opts.find(o => o.value === manualState) || opts[0];

  const handleChange = async (state: UserManualState, mood: CodingMoodState) => {
    setManualState(state);
    saveManualState(state);
    setExpanded(false); // 选择后收起

    try {
      await fetch(`${SIDECAR_BASE}/context/manual-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
    } catch (e) {
      // 同步失败，静默处理
    }
    const rec = await fetchRecommendation(mood, true);
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
        <span className={s.stateCurrentIcon}>{currentOption.icon}</span>
        <span className={s.stateCurrentLabel}>{currentOption.label}</span>
        <span className={s.stateCurrentArrow}>
          {expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
        </span>
      </button>
      {/* 展开的所有选项 */}
      {expanded && (
        <div className={s.stateSelector}>
          {opts.map(({ value, label, icon, mood }) => (
            <button
              key={label}
              className={`${s.stateBtn} ${manualState === value ? s.stateBtnActive : ''}`}
              onClick={() => handleChange(value, mood)}
              title={opts.find(o => o.value === value)?.desc}
            >
              <span className={s.stateBtnIcon}>{icon}</span>
              <span className={s.stateBtnLabel}>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
