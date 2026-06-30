import type { UserManualState, CodingMoodState } from '@music-coding/shared-types';
import { IconAuto, IconTarget, IconBrain, IconCreative, IconWrench, IconBook, IconEnergy, IconNight, IconCity, IconWave, IconAlert } from '@/components/common/Icons';

export interface MoodOption {
  value: UserManualState;
  label: string;
  desc: string;
  mood: CodingMoodState;
  icon: (size?: number) => React.ReactNode;
}

export const moodOptions: MoodOption[] = [
  { value: null, label: '自动', desc: '系统自动判断', mood: 'neutral', icon: (s = 14) => <IconAuto size={s} /> },
  { value: 'need_focus', label: '专注', desc: '中 BPM，有节奏感', mood: 'feature_flow', icon: (s = 14) => <IconTarget size={s} /> },
  { value: 'deep_work', label: '深度工作', desc: '低打扰，沉浸式', mood: 'deep_refactor', icon: (s = 14) => <IconBrain size={s} /> },
  { value: 'creative', label: '创意', desc: '轻松活力，灵感激发', mood: 'feature_flow', icon: (s = 14) => <IconCreative size={s} /> },
  { value: 'debugging', label: '调试', desc: '平静稳定，保持冷静', mood: 'debug_calm', icon: (s = 14) => <IconWrench size={s} /> },
  { value: 'reading', label: '阅读', desc: '极低干扰，纯背景', mood: 'review_focus', icon: (s = 14) => <IconBook size={s} /> },
  { value: 'need_energy', label: '提神', desc: '活力节奏，提振精神', mood: 'feature_flow', icon: (s = 14) => <IconEnergy size={s} /> },
  { value: 'need_relax', label: '放松', desc: '温柔舒缓，缓解压力', mood: 'low_energy', icon: (s = 14) => <IconNight size={s} /> },
  { value: 'low_state', label: '低状态', desc: '温和陪伴，慢慢恢复', mood: 'low_energy', icon: (s = 14) => <IconNight size={s} /> },
  { value: 'late_night', label: '深夜', desc: '深色氛围，低打扰', mood: 'late_night_flow', icon: (s = 14) => <IconCity size={s} /> },
  { value: 'background', label: '纯背景', desc: '白噪音，最小干扰', mood: 'review_focus', icon: (s = 14) => <IconWave size={s} /> },
  { value: 'emergency', label: '紧急', desc: '极低干扰或暂停', mood: 'emergency_focus', icon: (s = 14) => <IconAlert size={s} /> },
];
