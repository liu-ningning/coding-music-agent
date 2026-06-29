import { useState, useEffect } from 'react';
import type { CodingMoodState } from '@music-coding/shared-types';
import { fetchRecommendation } from '@/clients/musicClient';
import { useSessionStore } from '@/stores/sessionStore';
import { useMusicStore } from '@/stores/musicStore';
import { audioPlayer } from '@/clients/audioPlayer';
import { IconTarget, IconNight, IconFire, IconMute, IconMusic, IconCheck } from '@/components/common/Icons';
import { SIDECAR_BASE } from '@/config';
import s from '@/styles/layout.module.css';

interface PreferenceOption {
  id: string;
  label: string;
  description: string;
  mood: CodingMoodState;
  icon: React.ReactNode;
}

const preferenceOptions: PreferenceOption[] = [
  {
    id: 'focus',
    label: '更专注',
    description: '适合写代码、调试时的音乐',
    mood: 'feature_flow',
    icon: <IconTarget size={20} />,
  },
  {
    id: 'relaxed',
    label: '更轻松',
    description: '适合休息、恢复时的音乐',
    mood: 'low_energy',
    icon: <IconNight size={20} />,
  },
  {
    id: 'energy',
    label: '更燃',
    description: '适合需要提神、有活力的音乐',
    mood: 'feature_flow',
    icon: <IconFire size={20} />,
  },
  {
    id: 'calm',
    label: '更平静',
    description: '适合深夜、需要安静的音乐',
    mood: 'debug_calm',
    icon: <IconMute size={20} />,
  },
  {
    id: 'ambient',
    label: '环境音',
    description: '白噪音、自然声音',
    mood: 'review_focus',
    icon: <IconMusic size={20} />,
  },
];

interface RecommendationPreferencesProps {
  onSave: (preferences: string[]) => void;
  onClose: () => void;
  projectId?: string;
  projectName?: string;
}

export function RecommendationPreferences({ onSave, onClose, projectId, projectName }: RecommendationPreferencesProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [inheritGlobal, setInheritGlobal] = useState(true);
  const [isProjectMode, setIsProjectMode] = useState(false);

  // 从本地存储加载偏好设置
  useEffect(() => {
    if (projectId) {
      // 项目模式：从后端加载项目偏好
      setIsProjectMode(true);
      loadProjectPreferences(projectId);
    } else {
      // 全局模式：从本地存储加载
      const saved = localStorage.getItem('musicPreferences');
      if (saved) {
        try {
          setSelected(JSON.parse(saved));
        } catch (e) {
          // 加载偏好失败，静默处理
        }
      }
    }
  }, [projectId]);

  const loadProjectPreferences = async (pid: string) => {
    try {
      const res = await fetch(`${SIDECAR_BASE}/music/project-preferences/${pid}`);
      if (res.ok) {
        const data = await res.json();
        if (data.preferences) {
          setSelected(data.preferences);
          setInheritGlobal(data.inheritGlobal ?? true);
        }
      }
    } catch (e) {
      // 加载项目偏好失败，静默处理
    }
  };

  const togglePreference = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (isProjectMode && projectId && projectName) {
      // 保存项目级偏好
      try {
        await fetch(`${SIDECAR_BASE}/music/project-preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            projectName,
            preferences: selected,
            inheritGlobal,
          }),
        });
      } catch (e) {
        // 保存项目偏好失败，静默处理
      }
    } else {
      // 保存全局偏好
      localStorage.setItem('musicPreferences', JSON.stringify(selected));
    }

    onSave(selected);
    onClose();

    // 触发推荐刷新
    const sessionId = useSessionStore.getState().current?.id;
    if (sessionId) {
      const rec = await fetchRecommendation(undefined, true);
      if (rec && rec.tracks.length > 0) {
        await audioPlayer.playTrack(rec.tracks[0]);
      }
    }
  };

  return (
    <div className={s.preferencesPanel}>
      <div className={s.preferencesHeader}>
        <div className={s.preferencesTitle}>
          {isProjectMode ? `项目偏好 - ${projectName}` : '推荐偏好'}
        </div>
        <div className={s.preferencesSubtitle}>
          {isProjectMode
            ? '为此项目设置专属的音乐偏好'
            : '选择你偏好的音乐风格，影响推荐结果'}
        </div>
      </div>

      {/* 项目模式：继承全局偏好选项 */}
      {isProjectMode && (
        <div className={s.preferenceInheritRow}>
          <label className={s.preferenceInheritLabel}>
            <input
              type="checkbox"
              checked={inheritGlobal}
              onChange={(e) => setInheritGlobal(e.target.checked)}
              className={s.preferenceInheritCheckbox}
            />
            继承全局偏好
          </label>
          <span className={s.preferenceInheritDesc}>
            {inheritGlobal ? '项目偏好将与全局偏好合并' : '仅使用项目专属偏好'}
          </span>
        </div>
      )}

      <div className={s.preferencesList}>
        {preferenceOptions.map((option) => (
          <div
            key={option.id}
            className={`${s.preferenceItem} ${selected.includes(option.id) ? s.preferenceItemActive : ''}`}
            onClick={() => togglePreference(option.id)}
          >
            <div className={s.preferenceIcon}>{option.icon}</div>
            <div className={s.preferenceContent}>
              <div className={s.preferenceLabel}>{option.label}</div>
              <div className={s.preferenceDesc}>{option.description}</div>
            </div>
            <div className={s.preferenceCheck}>
              {selected.includes(option.id) && <IconCheck size={16} />}
            </div>
          </div>
        ))}
      </div>

      <div className={s.preferencesFooter}>
        <button className={s.preferencesCancelBtn} onClick={onClose}>
          取消
        </button>
        <button className={s.preferencesSaveBtn} onClick={handleSave}>
          保存
        </button>
      </div>
    </div>
  );
}
