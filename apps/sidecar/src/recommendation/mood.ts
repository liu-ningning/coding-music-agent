import type { CodingMoodState, CodingContext, TimeOfDay } from '@music-coding/shared-types';

/**
 * 根据 CodingContext 判断当前 CodingMoodState
 *
 * 判断优先级：
 * 1. 手动状态（用户显式选择）
 * 2. 紧急任务（hotfix）
 * 3. Debug 失败
 * 4. 任务类型（review/refactor/feature）
 * 5. 长时间疲劳
 * 6. 深夜时段
 * 7. 恢复中
 * 8. 默认 neutral
 */
export function determineMood(ctx: CodingContext): CodingMoodState {
  const { timeOfDay, manualState, agentStatus, taskType, failureCount, sessionDurationMs } = ctx;

  // 1. 手动状态优先
  if (manualState === 'emergency') return 'emergency_focus';
  if (manualState === 'need_focus') return 'feature_flow';
  if (manualState === 'need_relax') return 'low_energy';
  if (manualState === 'need_energy') return 'feature_flow';
  if (manualState === 'low_state') return 'low_energy';

  // 2. Emergency
  if (taskType === 'hotfix') return 'emergency_focus';

  // 3. Debug
  if (taskType === 'debug' || failureCount >= 2) return 'debug_calm';

  // 4. Review
  if (taskType === 'review') return 'review_focus';

  // 5. Refactor
  if (taskType === 'refactor') {
    if (timeOfDay === 'late_night') return 'deep_refactor';
    return 'deep_refactor';
  }

  // 6. Feature
  if (taskType === 'feature') return 'feature_flow';

  // 7. 长时间疲劳（超过 2 小时）
  if (sessionDurationMs > 2 * 60 * 60 * 1000) return 'low_energy';

  // 8. 深夜
  if (timeOfDay === 'late_night') return 'late_night_flow';

  // 9. 恢复中
  if (agentStatus === 'completed' && failureCount > 0) return 'recovery_mode';

  return 'neutral';
}

/**
 * 判断是否是深夜时段
 */
export function isLateNight(timeOfDay: TimeOfDay): boolean {
  return timeOfDay === 'late_night';
}

/**
 * 判断是否需要低打扰模式
 */
export function needsLowDistraction(mood: CodingMoodState): boolean {
  return ['debug_calm', 'emergency_focus', 'review_focus', 'deep_refactor'].includes(mood);
}
