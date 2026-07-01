import type {
  CodingMoodState,
  MusicFeedbackAction,
  FeedbackRecord,
  PreferenceLearning,
  ProjectPreferences,
} from '@music-coding/shared-types';
import { randomUUID } from 'crypto';
import { preferenceStore } from '../storage/store';
import { createLogger } from '../utils/logger';
import type { UserStyleProfile } from '../music/features';

const log = createLogger('preference');

// 反馈动作对权重的影响
const FEEDBACK_WEIGHT_IMPACT: Partial<Record<MusicFeedbackAction, number>> = {
  like: 0.1,           // 正向反馈，增加权重
  dislike: -0.1,       // 负向反馈，降低权重
  more_focus: 0.05,    // 偏好调整，小幅增加
  more_relaxed: 0.05,
  more_energy: 0.05,
  less_distraction: 0.05,
  change_set: 0,       // 换一组，不影响权重
  keep_vibe: 0,        // 保持氛围，不影响权重
};

// 反馈动作对应的 Mood 偏好
const FEEDBACK_MOOD_PREFERENCE: Partial<Record<MusicFeedbackAction, CodingMoodState[]>> = {
  more_focus: ['feature_flow', 'review_focus'],
  more_relaxed: ['low_energy', 'debug_calm'],
  more_energy: ['feature_flow'],
  less_distraction: ['debug_calm', 'review_focus'],
};

// 衰减配置
const DECAY_CONFIG = {
  decayPeriodMs: 60 * 60 * 1000,  // 1 小时（毫秒）
  decayRate: 0.5,                  // 衰减率（50%）
  defaultWeight: 0.5,              // 默认权重
};

export class PreferenceService {
  private learningData: Map<string, PreferenceLearning> = new Map();
  private projectPreferences: Map<string, ProjectPreferences> = new Map();

  constructor() {
    // 从存储中加载学习数据
    this.loadFromStorage();
    // 从存储中加载项目偏好
    this.loadProjectPreferencesFromStorage();
  }

  /**
   * 记录反馈
   */
  recordFeedback(sessionId: string, mood: CodingMoodState, action: MusicFeedbackAction): void {
    const learning = this.getOrCreateLearning(sessionId);

    // 创建反馈记录
    const record: FeedbackRecord = {
      sessionId,
      mood,
      action,
      timestamp: new Date().toISOString(),
    };

    // 添加到历史记录
    learning.feedbackHistory.push(record);

    // 更新权重
    this.updateWeights(learning, mood, action);

    // 更新最后更新时间
    learning.lastUpdated = new Date().toISOString();

    // 保存到存储
    this.saveToStorage();

    log.info(`反馈记录: ${action} (${mood})`);
  }

  /**
   * 获取学习数据（应用衰减）
   */
  getLearning(sessionId: string): PreferenceLearning | null {
    const learning = this.learningData.get(sessionId);
    if (!learning) {
      return null;
    }

    // 应用衰减
    this.applyDecay(learning);

    return learning;
  }

  /**
   * 应用衰减
   */
  private applyDecay(learning: PreferenceLearning): void {
    const now = new Date().getTime();
    const lastUpdated = new Date(learning.lastUpdated).getTime();
    const elapsedMs = now - lastUpdated;

    // 如果距离上次更新不足一个衰减周期，不需要衰减
    if (elapsedMs < DECAY_CONFIG.decayPeriodMs) {
      return;
    }

    // 计算衰减周期数
    const decayPeriods = elapsedMs / DECAY_CONFIG.decayPeriodMs;

    // 计算衰减因子（指数衰减）
    const decayFactor = Math.pow(DECAY_CONFIG.decayRate, decayPeriods);

    // 对每个 Mood 的权重应用衰减
    const moods = Object.keys(learning.styleWeights) as CodingMoodState[];
    moods.forEach(mood => {
      const currentWeight = learning.styleWeights[mood];
      const defaultWeight = DECAY_CONFIG.defaultWeight;

      // 权重向默认值衰减
      // 公式：newWeight = defaultWeight + (currentWeight - defaultWeight) * decayFactor
      const newWeight = defaultWeight + (currentWeight - defaultWeight) * decayFactor;
      learning.styleWeights[mood] = Math.max(0, Math.min(1, newWeight));
    });

    // 更新最后更新时间
    learning.lastUpdated = new Date().toISOString();

    // 保存到存储
    this.saveToStorage();

    // 衰减计算完成
  }

  /**
   * 获取或创建学习数据
   */
  private getOrCreateLearning(sessionId: string): PreferenceLearning {
    let learning = this.learningData.get(sessionId);

    if (!learning) {
      learning = {
        id: `learn_${randomUUID().slice(0, 8)}`,
        styleWeights: this.getDefaultWeights(),
        feedbackHistory: [],
        lastUpdated: new Date().toISOString(),
      };
      this.learningData.set(sessionId, learning);
    }

    return learning;
  }

  /**
   * 获取默认权重
   */
  private getDefaultWeights(): Record<CodingMoodState, number> {
    const moods: CodingMoodState[] = [
      'feature_flow',
      'debug_calm',
      'deep_refactor',
      'review_focus',
      'emergency_focus',
      'low_energy',
      'late_night_flow',
      'recovery_mode',
      'neutral',
    ];

    const weights: Record<string, number> = {};
    moods.forEach(mood => {
      weights[mood] = 0.5; // 默认权重
    });

    return weights as Record<CodingMoodState, number>;
  }

  /**
   * 更新权重
   */
  private updateWeights(learning: PreferenceLearning, mood: CodingMoodState, action: MusicFeedbackAction): void {
    const impact = FEEDBACK_WEIGHT_IMPACT[action] || 0;

    // 更新当前 Mood 的权重
    const currentWeight = learning.styleWeights[mood] || 0.5;
    const newWeight = Math.max(0, Math.min(1, currentWeight + impact));
    learning.styleWeights[mood] = newWeight;

    // 如果有偏好调整，更新相关 Mood 的权重
    const preferredMoods = FEEDBACK_MOOD_PREFERENCE[action];
    if (preferredMoods) {
      preferredMoods.forEach(preferredMood => {
        if (preferredMood !== mood) {
          const preferredWeight = learning.styleWeights[preferredMood] || 0.5;
          const adjustedWeight = Math.max(0, Math.min(1, preferredWeight + impact * 0.5));
          learning.styleWeights[preferredMood] = adjustedWeight;
        }
      });
    }
  }

  /**
   * 重置学习数据
   */
  resetLearning(sessionId: string): void {
    this.learningData.delete(sessionId);
    this.saveToStorage();
    log.info(`重置学习数据: ${sessionId}`);
  }

  /**
   * 基于红心歌曲风格画像初始化偏好权重
   * 授权后调用，让新 Session 从用户真实偏好开始
   */
  initializeFromStyleProfile(sessionId: string, profile: UserStyleProfile): void {
    if (profile.trackCount === 0) {
      log.info('红心歌曲为空，使用默认权重');
      return;
    }

    const learning = this.getOrCreateLearning(sessionId);

    // 根据偏好 Mood 设置权重
    for (const mood of profile.preferredMoods) {
      // 偏好 Mood 权重设为 0.7（高于默认 0.5）
      learning.styleWeights[mood] = 0.7;
    }

    // 根据平均特征调整其他 Mood 权重
    const { avgFeatures } = profile;

    // 高能量用户 → feature_flow 权重高
    if (avgFeatures.energy > 0.6) {
      learning.styleWeights.feature_flow = Math.max(learning.styleWeights.feature_flow, 0.65);
    }

    // 低能量 + 高器乐度 → debug_calm, deep_refactor 权重高
    if (avgFeatures.energy < 0.4 && avgFeatures.instrumentalness > 0.6) {
      learning.styleWeights.debug_calm = Math.max(learning.styleWeights.debug_calm, 0.65);
      learning.styleWeights.deep_refactor = Math.max(learning.styleWeights.deep_refactor, 0.65);
    }

    // 高器乐度 → review_focus 权重高
    if (avgFeatures.instrumentalness > 0.7) {
      learning.styleWeights.review_focus = Math.max(learning.styleWeights.review_focus, 0.65);
    }

    // 更新最后更新时间
    learning.lastUpdated = new Date().toISOString();

    // 保存到存储
    this.saveToStorage();

    log.info(`基于红心歌曲初始化偏好: ${profile.trackCount} 首, 偏好 Mood: ${profile.preferredMoods.join(', ')}`);
  }

  /**
   * 获取所有学习数据
   */
  getAllLearning(): Map<string, PreferenceLearning> {
    return new Map(this.learningData);
  }

  /**
   * 从存储加载学习数据
   */
  private loadFromStorage(): void {
    try {
      const stored = preferenceStore.get('learning');
      if (stored) {
        const data = JSON.parse(stored as string);
        Object.entries(data).forEach(([sessionId, learning]) => {
          this.learningData.set(sessionId, learning as PreferenceLearning);
        });
        log.info(`加载 ${this.learningData.size} 条学习记录`);
      }
    } catch (e) {
      log.error(`加载学习数据失败: ${e}`);
    }
  }

  /**
   * 保存学习数据到存储
   */
  private saveToStorage(): void {
    try {
      const data: Record<string, PreferenceLearning> = {};
      this.learningData.forEach((learning, sessionId) => {
        data[sessionId] = learning;
      });
      preferenceStore.set('learning', JSON.stringify(data));
    } catch (e) {
      log.error(`保存学习数据失败: ${e}`);
    }
  }

  // ── 项目级偏好管理 ──

  /**
   * 设置项目级偏好
   */
  setProjectPreferences(projectId: string, projectName: string, preferences: string[], inheritGlobal: boolean = true): void {
    const existing = this.projectPreferences.get(projectId);
    const projectPrefs: ProjectPreferences = {
      projectId,
      projectName,
      preferences,
      inheritGlobal,
      lastUsed: new Date().toISOString(),
    };

    this.projectPreferences.set(projectId, projectPrefs);
    this.saveProjectPreferencesToStorage();

    log.info(`设置项目偏好: ${projectName}`);
  }

  /**
   * 获取项目级偏好
   */
  getProjectPreferences(projectId: string): ProjectPreferences | null {
    return this.projectPreferences.get(projectId) || null;
  }

  /**
   * 删除项目级偏好
   */
  deleteProjectPreferences(projectId: string): void {
    this.projectPreferences.delete(projectId);
    this.saveProjectPreferencesToStorage();
    log.info(`删除项目偏好: ${projectId}`);
  }

  /**
   * 获取所有项目级偏好
   */
  getAllProjectPreferences(): Map<string, ProjectPreferences> {
    return new Map(this.projectPreferences);
  }

  /**
   * 获取项目偏好（考虑全局继承）
   */
  getProjectPreferencesWithGlobal(projectId: string, globalPreferences: string[]): string[] {
    const projectPrefs = this.getProjectPreferences(projectId);

    if (!projectPrefs) {
      // 项目没有设置偏好，使用全局偏好
      return globalPreferences;
    }

    if (projectPrefs.inheritGlobal) {
      // 继承全局偏好，合并项目偏好
      const merged = new Set([...globalPreferences, ...projectPrefs.preferences]);
      return Array.from(merged);
    }

    // 不继承全局偏好，只使用项目偏好
    return projectPrefs.preferences;
  }

  /**
   * 从存储加载项目偏好
   */
  private loadProjectPreferencesFromStorage(): void {
    try {
      const stored = preferenceStore.get('projectPreferences');
      if (stored) {
        const data = JSON.parse(stored as string);
        Object.entries(data).forEach(([projectId, prefs]) => {
          this.projectPreferences.set(projectId, prefs as ProjectPreferences);
        });
        log.info(`加载 ${this.projectPreferences.size} 条项目偏好`);
      }
    } catch (e) {
      log.error(`加载项目偏好失败: ${e}`);
    }
  }

  /**
   * 保存项目偏好到存储
   */
  private saveProjectPreferencesToStorage(): void {
    try {
      const data: Record<string, ProjectPreferences> = {};
      this.projectPreferences.forEach((prefs, projectId) => {
        data[projectId] = prefs;
      });
      preferenceStore.set('projectPreferences', JSON.stringify(data));
    } catch (e) {
      log.error(`保存项目偏好失败: ${e}`);
    }
  }
}
