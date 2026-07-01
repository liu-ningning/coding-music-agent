import type {
  MusicTrack,
  PlaybackState,
  MusicRecommendation,
  MusicAtmosphere,
  CodingMoodState,
  MusicFeedbackAction,
  DiversityScore,
} from '@music-coding/shared-types';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { NeteaseMusicProvider } from './netease';
import { feedbackStore, recommendationStore } from '../storage/store';
import { PreferenceService } from '../preference/service';
import { FeatureExtractor } from './features';
import { createLogger } from '../utils/logger';

const log = createLogger('music');

export const musicEvents = new EventEmitter();

// Mood 预热优先级配置
const MOOD_WARMUP_PRIORITY: { mood: CodingMoodState; priority: number }[] = [
  { mood: 'neutral', priority: 1 },
  { mood: 'feature_flow', priority: 2 },
  { mood: 'debug_calm', priority: 3 },
  { mood: 'low_energy', priority: 4 },
  { mood: 'deep_refactor', priority: 5 },
  { mood: 'review_focus', priority: 6 },
  { mood: 'emergency_focus', priority: 7 },
  { mood: 'late_night_flow', priority: 8 },
  { mood: 'recovery_mode', priority: 9 },
];

export class MusicService {
  private provider: NeteaseMusicProvider;
  private preferenceService: PreferenceService;
  private featureExtractor: FeatureExtractor;
  private currentPlayback: PlaybackState = { status: 'stopped', volume: 30 };
  private trackCache: Map<string, MusicTrack[]> = new Map();

  // 预热状态
  private warmupStatus: Map<CodingMoodState, 'pending' | 'warming' | 'ready' | 'failed'> = new Map();
  private warmupInProgress = false;
  private highPriorityWarmed = false;

  constructor() {
    this.provider = new NeteaseMusicProvider();
    this.preferenceService = new PreferenceService();
    this.featureExtractor = new FeatureExtractor();
    // 初始化所有 Mood 的预热状态为 pending
    MOOD_WARMUP_PRIORITY.forEach(({ mood }) => {
      this.warmupStatus.set(mood, 'pending');
    });
  }

  async getAuthStatus() {
    return this.provider.getAuthStatus();
  }

  async startAuth() {
    const result = await this.provider.startAuth();
    this.provider.simulateLogin();
    return result;
  }

  /**
   * 生成二维码登录凭证
   * 返回 key 和 base64 格式的二维码图片
   */
  async startQrAuth(): Promise<{ key: string; qrimg: string }> {
    return this.provider.createQrCode();
  }

  /**
   * 轮询二维码扫码状态
   * code: 800=过期, 801=等待扫码, 802=已扫码待确认, 803=登录成功
   */
  async checkQrAuth(key: string): Promise<{ code: number; message: string }> {
    const result = await this.provider.checkQrStatus(key);

    // 将 code 转换为用户友好的消息
    let message = '';
    switch (result.code) {
      case 800:
        message = '二维码已过期，请刷新';
        break;
      case 801:
        message = '等待扫码';
        break;
      case 802:
        message = '已扫码，请在手机上确认';
        break;
      case 803:
        message = '登录成功';
        break;
      default:
        message = '未知状态';
    }

    return { code: result.code, message };
  }

  /**
   * 退出登录
   */
  async logout(): Promise<void> {
    await this.provider.logout();
  }

  async recommend(sessionId: string, mood: CodingMoodState, refresh: boolean = false, preferences: string[] = [], playedTrackIds: string[] = []): Promise<MusicRecommendation> {
    let tracks: MusicTrack[] = [];
    let source = 'netease';

    try {
      tracks = await this.fetchTracksByMood(mood, refresh, preferences, playedTrackIds, sessionId);
    } catch (e) {
      log.error(`获取歌曲失败: ${e}`);
      source = 'fallback';
    }

    if (tracks.length === 0) {
      try {
        tracks = await this.provider.getHotTracks();
        source = 'hot';
      } catch {}
    }

    if (tracks.length > 0) {
      tracks = await this.provider.fillTrackUrls(tracks);
    }

    const atmosphere = this.moodToAtmosphere(mood);
    const reason = this.generateReason(mood, source, preferences);
    const finalTracks = tracks.slice(0, 50);

    // 计算多样性分数
    const diversityScore = this.calculateDiversityScore(finalTracks);

    const recommendation: MusicRecommendation = {
      id: `rec_${randomUUID().slice(0, 8)}`,
      sessionId,
      mode: 'smart_radio',
      title: `${this.moodToLabel(mood)} Radio`,
      reason,
      tracks: finalTracks,
      atmosphere,
      contextUsed: ['mood', 'time', source],
      createdAt: new Date().toISOString(),
      diversityScore,
    };

    // 保存推荐
    recommendationStore.add({
      id: recommendation.id,
      sessionId,
      mode: recommendation.mode,
      title: recommendation.title,
      reason: recommendation.reason,
      tracks: recommendation.tracks,
      atmosphere: recommendation.atmosphere,
      createdAt: recommendation.createdAt,
    });

    musicEvents.emit('music.recommendation.ready', { recommendation });
    return recommendation;
  }

  /**
   * 记录反馈（用于偏好学习）
   */
  recordFeedbackWithLearning(sessionId: string, mood: CodingMoodState, action: MusicFeedbackAction): void {
    // 记录到偏好学习
    this.preferenceService.recordFeedback(sessionId, mood, action);

    // 记录到原有的反馈存储
    const feedback = {
      id: `fb_${randomUUID().slice(0, 8)}`,
      sessionId,
      recommendationId: '', // 可以为空
      action,
      createdAt: new Date().toISOString(),
    };

    feedbackStore.add(feedback);
    musicEvents.emit('music.feedback.recorded', { feedback });
  }

  /**
   * 获取偏好学习数据
   */
  getPreferenceLearning(sessionId: string) {
    return this.preferenceService.getLearning(sessionId);
  }

  /**
   * 重置偏好学习数据
   */
  resetPreferenceLearning(sessionId: string): void {
    this.preferenceService.resetLearning(sessionId);
  }

  // ── 项目级偏好管理 ──

  /**
   * 设置项目级偏好
   */
  setProjectPreferences(projectId: string, projectName: string, preferences: string[], inheritGlobal: boolean = true): void {
    this.preferenceService.setProjectPreferences(projectId, projectName, preferences, inheritGlobal);
  }

  /**
   * 获取项目级偏好
   */
  getProjectPreferences(projectId: string) {
    return this.preferenceService.getProjectPreferences(projectId);
  }

  /**
   * 删除项目级偏好
   */
  deleteProjectPreferences(projectId: string): void {
    this.preferenceService.deleteProjectPreferences(projectId);
  }

  /**
   * 获取所有项目级偏好
   */
  getAllProjectPreferences() {
    return this.preferenceService.getAllProjectPreferences();
  }

  /**
   * 获取项目偏好（考虑全局继承）
   */
  getProjectPreferencesWithGlobal(projectId: string, globalPreferences: string[]): string[] {
    return this.preferenceService.getProjectPreferencesWithGlobal(projectId, globalPreferences);
  }

  /**
   * 获取歌曲特征
   */
  getTrackFeatures(trackId: string) {
    // 从缓存中查找歌曲
    for (const tracks of this.trackCache.values()) {
      const track = tracks.find(t => t.providerTrackId === trackId);
      if (track) {
        return this.featureExtractor.extractFeatures(track);
      }
    }
    return null;
  }

  /**
   * 获取歌词
   */
  async getLyrics(trackId: string): Promise<{ lrc: string; tlyric?: string } | null> {
    try {
      if (!this.provider || !('getLyrics' in this.provider)) return null;
      return await (this.provider as any).getLyrics(trackId);
    } catch {
      return null;
    }
  }

  /**
   * 计算推荐结果的多样性分数
   */
  private calculateDiversityScore(tracks: MusicTrack[]): DiversityScore {
    if (tracks.length === 0) {
      return {
        overall: 0,
        artistDiversity: 0,
        albumDiversity: 0,
        durationDiversity: 0,
        recommendations: ['推荐列表为空'],
      };
    }

    // 计算艺术家多样性
    const allArtists = tracks.flatMap(t => t.artists);
    const uniqueArtists = new Set(allArtists);
    const artistDiversity = Math.min(uniqueArtists.size / tracks.length, 1);

    // 计算专辑多样性
    const albums = new Set(tracks.map(t => t.album).filter(Boolean));
    const albumDiversity = Math.min(albums.size / tracks.length, 1);

    // 计算时长多样性
    const durations = tracks.map(t => t.durationMs).filter((d): d is number => d != null && d > 0);
    let durationDiversity = 0;
    if (durations.length > 0) {
      const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
      const variance = durations.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / durations.length;
      const stdDev = Math.sqrt(variance);
      durationDiversity = Math.min(stdDev / 120000, 1); // 归一化到 0-1
    }

    // 计算总体多样性分数（加权平均）
    const overall = (
      artistDiversity * 0.5 +
      albumDiversity * 0.3 +
      durationDiversity * 0.2
    );

    // 生成改进建议
    const recommendations: string[] = [];
    if (artistDiversity < 0.6) {
      recommendations.push('增加不同艺术家的歌曲');
    }
    if (albumDiversity < 0.5) {
      recommendations.push('增加不同专辑的歌曲');
    }
    if (durationDiversity < 0.4) {
      recommendations.push('增加不同时长的歌曲');
    }
    if (recommendations.length === 0) {
      recommendations.push('多样性良好');
    }

    return {
      overall,
      artistDiversity,
      albumDiversity,
      durationDiversity,
      recommendations,
    };
  }

  private async fetchTracksByMood(mood: CodingMoodState, refresh: boolean = false, preferences: string[] = [], playedTrackIds: string[] = [], sessionId?: string): Promise<MusicTrack[]> {
    // 不使用缓存时，清除该 mood 的缓存
    if (refresh) {
      this.trackCache.delete(mood);
    }

    const cached = this.trackCache.get(mood);
    if (cached && cached.length > 0) {
      // 从缓存中过滤掉已播放的歌曲
      const playedSet = new Set(playedTrackIds);
      const filtered = cached.filter(t => !playedSet.has(t.providerTrackId));
      if (filtered.length > 0) return filtered;
      // 如果缓存中的歌曲都已播放，继续获取新歌曲
    }

    // 获取搜索关键词（refresh 时打乱顺序）
    let queries = this.moodToSearchQueries(mood);

    // 根据偏好调整搜索关键词
    if (preferences.length > 0) {
      queries = this.applyPreferences(queries, preferences);
    }

    // 根据学习权重调整搜索关键词顺序
    if (sessionId) {
      queries = this.applyLearningWeights(queries, sessionId, mood);
    }

    if (refresh) {
      queries = this.shuffleArray([...queries]);
    }

    let allTracks: MusicTrack[] = [];

    for (const query of queries) {
      const results = await this.provider.searchTracks(query);
      allTracks.push(...results);
      if (allTracks.length >= 50) break;
    }

    // 去重（单次请求内）
    const seen = new Set<string>();
    allTracks = allTracks.filter(t => {
      if (seen.has(t.providerTrackId)) return false;
      seen.add(t.providerTrackId);
      return true;
    });

    // 过滤掉已播放的歌曲
    if (playedTrackIds.length > 0) {
      const playedSet = new Set(playedTrackIds);
      allTracks = allTracks.filter(t => !playedSet.has(t.providerTrackId));
    }

    // 使用特征匹配排序歌曲
    if (preferences.length > 0 || mood) {
      allTracks = this.sortByFeatureMatch(allTracks, preferences, mood);
    }

    // 打乱顺序（refresh 时）
    if (refresh) {
      allTracks = this.shuffleArray(allTracks);
    }

    if (allTracks.length > 0) {
      this.trackCache.set(mood, allTracks);
    }

    return allTracks;
  }

  /**
   * 使用特征匹配排序歌曲
   */
  private sortByFeatureMatch(tracks: MusicTrack[], preferences: string[], mood: CodingMoodState): MusicTrack[] {
    if (tracks.length === 0) {
      return tracks;
    }

    // 提取特征
    const featuresMap = this.featureExtractor.extractFeaturesBatch(tracks);

    // 计算每首歌的匹配分数
    const scoredTracks = tracks.map(track => {
      const features = featuresMap.get(track.providerTrackId);
      let score = 0.5; // 默认分数

      if (features) {
        score = this.featureExtractor.matchPreferences(features, preferences, mood);
      }

      return { track, score };
    });

    // 按分数排序（降序）
    scoredTracks.sort((a, b) => b.score - a.score);

    return scoredTracks.map(item => item.track);
  }

  /**
   * 根据学习权重调整搜索关键词顺序
   */
  private applyLearningWeights(queries: string[], sessionId: string, mood: CodingMoodState): string[] {
    const learning = this.preferenceService.getLearning(sessionId);
    if (!learning) {
      return queries;
    }

    // 获取当前 Mood 的权重
    const moodWeight = learning.styleWeights[mood] || 0.5;

    // 如果权重较高，保持原顺序（优先使用基础搜索词）
    // 如果权重较低，打乱顺序（尝试更多变体）
    if (moodWeight >= 0.6) {
      return queries;
    } else {
      return this.shuffleArray([...queries]);
    }
  }

  // 数组打乱
  private shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  async play(track?: MusicTrack): Promise<PlaybackState> {
    if (track) {
      this.currentPlayback = {
        status: 'playing',
        currentTrack: track,
        volume: this.currentPlayback.volume,
      };
    } else {
      this.currentPlayback.status = 'playing';
    }
    musicEvents.emit('music.playback.changed', { playback: this.currentPlayback });
    return this.currentPlayback;
  }

  async pause(): Promise<PlaybackState> {
    this.currentPlayback.status = 'paused';
    musicEvents.emit('music.playback.changed', { playback: this.currentPlayback });
    return this.currentPlayback;
  }

  async next(): Promise<PlaybackState> {
    const { recommendation } = this.currentPlayback as any;
    const tracks = recommendation?.tracks || [];

    if (tracks.length > 0) {
      const currentIdx = tracks.findIndex((t: MusicTrack) => t.id === this.currentPlayback.currentTrack?.id);
      const nextIdx = (currentIdx + 1) % tracks.length;
      this.currentPlayback = {
        status: 'playing',
        currentTrack: tracks[nextIdx],
        volume: this.currentPlayback.volume,
      };
    }

    musicEvents.emit('music.playback.changed', { playback: this.currentPlayback });
    return this.currentPlayback;
  }

  async getPlaybackState(): Promise<PlaybackState> {
    return this.currentPlayback;
  }

  recordFeedback(sessionId: string, recommendationId: string, action: MusicFeedbackAction): void {
    const feedback = {
      id: `fb_${randomUUID().slice(0, 8)}`,
      sessionId,
      recommendationId,
      action,
      createdAt: new Date().toISOString(),
    };

    feedbackStore.add(feedback);
    musicEvents.emit('music.feedback.recorded', { feedback });
  }

  // ── 私有方法 ──

  // 随机关键词池（按风格分类）
  private readonly RANDOM_KEYWORDS = {
    // 通用修饰词
    modifiers: ['轻松', '舒适', '愉悦', '宁静', '温暖', '清新', '自然', '纯净', '柔和', '优雅'],
    // 场景词
    scenes: ['工作', '学习', '阅读', '冥想', '休息', '旅行', '午后', '夜晚', '清晨', '黄昏'],
    // 情感词
    emotions: ['快乐', '平静', '专注', '放松', '活力', '温柔', '深沉', '明亮', '柔和', '宁静'],
    // 乐器词
    instruments: ['钢琴', '吉他', '小提琴', '大提琴', '长笛', '萨克斯', '竖琴', '手风琴', '口琴', '古筝'],
  };

  // 扩展的搜索词库（每个 Mood 有更多变体）
  private readonly EXTENDED_MOOD_QUERIES: Record<CodingMoodState, string[]> = {
    feature_flow: [
      '电子 节奏', '轻音乐 活力', 'EDM 编程',
      '电子 进阶', '节奏感 强', '动感 电子', '编程 背景',
      '高效 工作', '专注 音乐', '推进 感',
    ],
    debug_calm: [
      '纯音乐 舒缓', '钢琴 平静', 'ambient 放松',
      '轻柔 钢琴', '平静 心情', '舒缓 旋律', '安静 环境',
      '调试 背景', '冷静 思考', '平和 心态',
    ],
    deep_refactor: [
      'lo-fi 深夜', 'ambient 沉浸', '电子 低音',
      '深夜 工作', '沉浸 式', '低音 节奏', '重构 专注',
      '安静 氛围', '深度 思考', '代码 重构',
    ],
    review_focus: [
      '白噪音', '纯音乐 专注', '自然声音',
      '专注 背景', '低干扰', '安静 环境', '自然 音效',
      '代码 审查', '阅读 背景', '思考 音乐',
    ],
    emergency_focus: [
      '白噪音', '雨声', '自然声音',
      '紧急 修复', '快速 专注', '高效 工作', '集中 注意',
      '问题 解决', '调试 背景', '紧急 背景',
    ],
    low_energy: [
      '钢琴 温暖', '轻音乐 治愈', '纯音乐 舒适',
      '温暖 旋律', '治愈 系', '舒适 氛围', '恢复 精力',
      '温柔 钢琴', '轻柔 旋律', '放松 心情',
    ],
    late_night_flow: [
      '深夜 电子', 'lo-fi night', 'ambient dark',
      '夜晚 编码', '深夜 工作', '夜间 氛围', 'dark ambient',
      '夜间 电子', '深夜 钢琴', '夜晚 轻音乐',
    ],
    recovery_mode: [
      '轻音乐 恢复', '钢琴 轻柔', '电子 柔和',
      '恢复 模式', '渐进 恢复', '柔和 旋律', '轻柔 电子',
      '平静 恢复', '舒缓 恢复', '温暖 恢复',
    ],
    neutral: [
      '纯音乐', '轻音乐', 'ambient',
      '通用 背景', '日常 工作', '平衡 音乐', '中性 氛围',
      '工作 背景', '学习 音乐', '生活 背景',
    ],
  };

  private moodToSearchQueries(mood: CodingMoodState): string[] {
    // 使用扩展的搜索词库
    const baseQueries = this.EXTENDED_MOOD_QUERIES[mood] || this.EXTENDED_MOOD_QUERIES.neutral;

    // 从基础搜索词中随机选择 5 个
    const selectedQueries = this.shuffleArray([...baseQueries]).slice(0, 5);

    // 添加随机关键词组合
    const randomQueries = this.generateRandomQueries(3);

    // 合并并去重
    const allQueries = [...selectedQueries, ...randomQueries];
    const seen = new Set<string>();
    return allQueries.filter(q => {
      if (seen.has(q)) return false;
      seen.add(q);
      return true;
    });
  }

  // 生成随机搜索词
  private generateRandomQueries(count: number): string[] {
    const queries: string[] = [];

    for (let i = 0; i < count; i++) {
      // 随机选择关键词类型
      const keywordTypes = Object.keys(this.RANDOM_KEYWORDS) as Array<keyof typeof this.RANDOM_KEYWORDS>;
      const type1 = keywordTypes[Math.floor(Math.random() * keywordTypes.length)];
      let type2 = keywordTypes[Math.floor(Math.random() * keywordTypes.length)];

      // 确保两个类型不同
      while (type2 === type1) {
        type2 = keywordTypes[Math.floor(Math.random() * keywordTypes.length)];
      }

      // 从每个类型中随机选择一个关键词
      const keywords1 = this.RANDOM_KEYWORDS[type1];
      const keywords2 = this.RANDOM_KEYWORDS[type2];
      const keyword1 = keywords1[Math.floor(Math.random() * keywords1.length)];
      const keyword2 = keywords2[Math.floor(Math.random() * keywords2.length)];

      queries.push(`${keyword1} ${keyword2}`);
    }

    return queries;
  }

  // 根据偏好调整搜索关键词
  private applyPreferences(queries: string[], preferences: string[]): string[] {
    const preferenceKeywords: Record<string, string[]> = {
      focus: ['专注', '编程', '工作', '效率'],
      relaxed: ['放松', '舒缓', '治愈', '轻柔'],
      energy: ['活力', '节奏', '动感', '提神'],
      calm: ['平静', '安静', '深夜', '冥想'],
      ambient: ['白噪音', '自然', '环境', '雨声'],
    };

    // 收集所有偏好的关键词
    const extraKeywords: string[] = [];
    for (const pref of preferences) {
      if (preferenceKeywords[pref]) {
        extraKeywords.push(...preferenceKeywords[pref]);
      }
    }

    if (extraKeywords.length === 0) return queries;

    // 将偏好关键词与原有查询组合
    const adjustedQueries: string[] = [];
    for (const query of queries) {
      adjustedQueries.push(query);
      // 为每个原有查询添加一个带偏好的版本
      const randomKeyword = extraKeywords[Math.floor(Math.random() * extraKeywords.length)];
      adjustedQueries.push(`${query} ${randomKeyword}`);
    }

    return adjustedQueries;
  }

  private moodToLabel(mood: CodingMoodState): string {
    const map: Record<CodingMoodState, string> = {
      feature_flow: 'Feature Flow',
      debug_calm: 'Debug Calm',
      deep_refactor: 'Deep Refactor',
      review_focus: 'Review Focus',
      emergency_focus: 'Emergency Focus',
      low_energy: 'Low Energy',
      late_night_flow: 'Late Night',
      recovery_mode: 'Recovery',
      neutral: 'Neutral',
    };
    return map[mood] || 'Neutral';
  }

  private moodToAtmosphere(mood: CodingMoodState): MusicAtmosphere {
    const configs: Record<CodingMoodState, { intensity: 'low' | 'medium' | 'high'; distraction: 'minimal' | 'balanced' | 'energetic'; animation: 'none' | 'subtle' | 'active'; glow: string }> = {
      feature_flow: { intensity: 'medium', distraction: 'balanced', animation: 'active', glow: '#58A6A6' },
      debug_calm: { intensity: 'low', distraction: 'minimal', animation: 'subtle', glow: '#6F8FAF' },
      deep_refactor: { intensity: 'low', distraction: 'minimal', animation: 'subtle', glow: '#7E6FB5' },
      review_focus: { intensity: 'low', distraction: 'minimal', animation: 'none', glow: '#7A8B9A' },
      emergency_focus: { intensity: 'low', distraction: 'minimal', animation: 'subtle', glow: '#B56B6B' },
      low_energy: { intensity: 'low', distraction: 'minimal', animation: 'subtle', glow: '#9A8BAF' },
      late_night_flow: { intensity: 'low', distraction: 'minimal', animation: 'subtle', glow: '#4A5A7A' },
      recovery_mode: { intensity: 'low', distraction: 'minimal', animation: 'subtle', glow: '#58A6A6' },
      neutral: { intensity: 'medium', distraction: 'balanced', animation: 'subtle', glow: 'rgba(255,255,255,0.08)' },
    };

    const config = configs[mood] || configs.neutral;

    return {
      id: `atm_${randomUUID().slice(0, 8)}`,
      label: this.moodToLabel(mood),
      mood,
      intensity: config.intensity,
      distractionLevel: config.distraction,
      animationLevel: config.animation,
      colors: {
        backgroundGradient: `linear-gradient(135deg, #111111 0%, ${config.glow}22 100%)`,
        edgeGlow: config.glow,
        accent: config.glow,
      },
    };
  }

  private generateReason(mood: CodingMoodState, source: string, preferences: string[] = []): string {
    const sourceLabel = source === 'hot' ? '热歌榜' : source === 'netease' ? '网易云推荐' : '为你精选';

    // 基础推荐理由（根据 Mood）
    const moodReasons: Record<CodingMoodState, string[]> = {
      feature_flow: [
        '适合推进新功能的节奏感音乐',
        '帮助保持编码动力的活力旋律',
        '让代码如行云流水般顺畅的配乐',
      ],
      debug_calm: [
        'Debug 阶段需要的平静专注音乐',
        '帮助理清思路的舒缓旋律',
        '让 Bug 无处遁形的冷静配乐',
      ],
      deep_refactor: [
        '深夜重构的沉浸式氛围音乐',
        '让代码重构更有节奏感的配乐',
        '适合深度思考的低音环境音',
      ],
      review_focus: [
        '代码 Review 时的低干扰背景音',
        '帮助专注阅读代码的轻柔音乐',
        '让代码审查更高效的安静配乐',
      ],
      emergency_focus: [
        '紧急模式下的舒缓音乐',
        '帮助快速定位问题的专注配乐',
        '让紧急修复更从容的背景音',
      ],
      low_energy: [
        '温和陪伴恢复精力的音乐',
        '适合休息恢复的治愈旋律',
        '让疲惫感消散的轻柔配乐',
      ],
      late_night_flow: [
        '深夜编码的深色氛围音乐',
        '适合夜间工作的低亮度配乐',
        '让深夜编程更有氛围的背景音',
      ],
      recovery_mode: [
        '逐步恢复状态的轻柔音乐',
        '帮助重拾编码节奏的渐进旋律',
        '让状态回归的温和配乐',
      ],
      neutral: [
        '适合当前编码状态的音乐',
        '帮助保持工作节奏的背景音乐',
        '让编程更愉悦的通用配乐',
      ],
    };

    // 偏好增强理由
    const preferenceEnhancements: Record<string, string[]> = {
      focus: ['专注', '高效', '精准'],
      relaxed: ['轻松', '舒适', '愉悦'],
      energy: ['活力', '动感', '激情'],
      calm: ['平静', '安宁', '宁静'],
      ambient: ['沉浸', '环境', '氛围'],
    };

    // 随机选择一个基础理由
    const baseReasons = moodReasons[mood] || moodReasons.neutral;
    const baseReason = baseReasons[Math.floor(Math.random() * baseReasons.length)];

    // 如果有偏好，添加偏好增强
    let enhancement = '';
    if (preferences.length > 0) {
      const pref = preferences[0]; // 使用第一个偏好
      const enhancements = preferenceEnhancements[pref];
      if (enhancements) {
        const enhancementWord = enhancements[Math.floor(Math.random() * enhancements.length)];
        enhancement = `，更显${enhancementWord}`;
      }
    }

    return `来自${sourceLabel}，${baseReason}${enhancement}。`;
  }

  // ── 预热方法 ──

  /**
   * 启动时预加载高优先级 Mood（neutral 和 feature_flow）
   * 应用启动后立即调用，不阻塞主线程
   */
  async warmupHighPriorityMoods(): Promise<void> {
    if (this.highPriorityWarmed || this.warmupInProgress) {
      return;
    }

    this.warmupInProgress = true;
    log.info('开始高优先级预热');

    try {
      // 获取前 2 个高优先级 Mood
      const highPriorityMoods = MOOD_WARMUP_PRIORITY
        .filter(({ priority }) => priority <= 2)
        .map(({ mood }) => mood);

      // 并行预加载
      await Promise.allSettled(
        highPriorityMoods.map(mood => this.warmupMood(mood))
      );

      this.highPriorityWarmed = true;
      log.info('高优先级预热完成');

      // 触发预热完成事件
      musicEvents.emit('music.warmup.completed', {
        type: 'high_priority',
        moods: highPriorityMoods,
      });
    } catch (e) {
      log.error(`高优先级预热失败: ${e}`);
    } finally {
      this.warmupInProgress = false;
    }
  }

  /**
   * 预加载单个 Mood
   * @param mood 要预加载的 Mood
   * @param preferences 偏好设置（可选）
   */
  async warmupMood(mood: CodingMoodState, preferences: string[] = []): Promise<boolean> {
    const currentStatus = this.warmupStatus.get(mood);

    // 如果已经在预热或已完成，跳过
    if (currentStatus === 'warming' || currentStatus === 'ready') {
      return true;
    }

    // 如果之前失败过，跳过（避免重复失败）
    if (currentStatus === 'failed') {
      return false;
    }

    this.warmupStatus.set(mood, 'warming');
    log.info(`预热 mood: ${mood}`);

    try {
      // 获取搜索关键词
      let queries = this.moodToSearchQueries(mood);

      // 根据偏好调整搜索关键词
      if (preferences.length > 0) {
        queries = this.applyPreferences(queries, preferences);
      }

      // 搜索歌曲
      const allTracks: MusicTrack[] = [];
      for (const query of queries) {
        const results = await this.provider.searchTracks(query);
        allTracks.push(...results);
        if (allTracks.length >= 50) break;
      }

      // 去重
      const seen = new Set<string>();
      const uniqueTracks = allTracks.filter(t => {
        if (seen.has(t.providerTrackId)) return false;
        seen.add(t.providerTrackId);
        return true;
      });

      // 填充播放 URL
      if (uniqueTracks.length > 0) {
        const tracksWithUrl = await this.provider.fillTrackUrls(uniqueTracks);
        this.trackCache.set(mood, tracksWithUrl);
        this.warmupStatus.set(mood, 'ready');
        log.info(`${mood} 预热完成: ${tracksWithUrl.length} 首`);
        return true;
      } else {
        this.warmupStatus.set(mood, 'failed');
        log.warn(`${mood} 无可用歌曲`);
        return false;
      }
    } catch (e) {
      this.warmupStatus.set(mood, 'failed');
      log.error(`${mood} 预热失败: ${e}`);
      return false;
    }
  }

  /**
   * 后台预加载其他 Mood
   * 在用户首次请求推荐后调用，空闲时预加载
   */
  async backgroundWarmup(): Promise<void> {
    log.info('开始后台预热');

    // 获取未预热的 Mood（按优先级排序）
    const pendingMoods = MOOD_WARMUP_PRIORITY
      .filter(({ mood }) => {
        const status = this.warmupStatus.get(mood);
        return status === 'pending' || status === 'failed';
      })
      .sort((a, b) => a.priority - b.priority)
      .map(({ mood }) => mood);

    if (pendingMoods.length === 0) {
      log.info('所有 mood 已预热');
      return;
    }

    log.info(`后台预热 ${pendingMoods.length} 个 mood: ${pendingMoods.join(', ')}`);

    // 串行预加载，避免并发过高
    for (const mood of pendingMoods) {
      try {
        await this.warmupMood(mood);
        // 短暂延迟，避免 API 压力
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        log.error(`后台预热失败 ${mood}: ${e}`);
        // 继续预热其他 Mood
      }
    }

    log.info('后台预热完成');

    // 触发后台预热完成事件
    musicEvents.emit('music.warmup.completed', {
      type: 'background',
      moods: pendingMoods,
    });
  }

  /**
   * 获取预热状态
   */
  getWarmupStatus(): {
    highPriorityWarmed: boolean;
    moods: Record<CodingMoodState, 'pending' | 'warming' | 'ready' | 'failed'>;
  } {
    const moods: Record<string, 'pending' | 'warming' | 'ready' | 'failed'> = {};
    this.warmupStatus.forEach((status, mood) => {
      moods[mood] = status;
    });

    return {
      highPriorityWarmed: this.highPriorityWarmed,
      moods: moods as Record<CodingMoodState, 'pending' | 'warming' | 'ready' | 'failed'>,
    };
  }

  /**
   * 检查指定 Mood 是否已预热
   */
  isMoodWarmed(mood: CodingMoodState): boolean {
    return this.warmupStatus.get(mood) === 'ready';
  }
}
