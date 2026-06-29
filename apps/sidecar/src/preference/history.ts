import type {
  MusicTrack,
  ListeningRecord,
  UserProfile,
  TrackFeatures,
} from '@music-coding/shared-types';
import { randomUUID, createHash } from 'crypto';
import { preferenceStore } from '../storage/store';
import { FeatureExtractor } from '../music/features';
import { createLogger } from '../utils/logger';

const log = createLogger('history');

// 默认特征偏好
const DEFAULT_FEATURE_PREFERENCES: TrackFeatures = {
  bpm: 100,
  energy: 0.5,
  valence: 0.5,
  danceability: 0.5,
  instrumentalness: 0.5,
};

// 隐私配置
const PRIVACY_CONFIG = {
  anonymizeUserId: true,           // 是否匿名化用户 ID
  hashSalt: 'music-coding-privacy', // 哈希盐值
  maxHistoryDays: 90,              // 最大保留天数
  dataRetentionCount: 1000,        // 最大保留记录数
};

export class ListeningHistoryService {
  private profiles: Map<string, UserProfile> = new Map();
  private featureExtractor: FeatureExtractor;
  private userIdMapping: Map<string, string> = new Map(); // 原始 ID -> 匿名 ID

  constructor() {
    this.featureExtractor = new FeatureExtractor();
    this.loadFromStorage();
  }

  /**
   * 记录听歌
   */
  recordListening(userId: string, track: MusicTrack, rating?: number): void {
    const profile = this.getOrCreateProfile(userId);

    // 创建听歌记录
    const record: ListeningRecord = {
      trackId: track.providerTrackId,
      trackName: track.title,
      artist: track.artists.join(', '),
      genre: this.extractGenre(track),
      duration: track.durationMs || 0,
      timestamp: new Date().toISOString(),
      rating,
    };

    // 添加到历史记录
    profile.listeningHistory.push(record);

    // 限制历史记录数量（保留最近 1000 条）
    if (profile.listeningHistory.length > 1000) {
      profile.listeningHistory = profile.listeningHistory.slice(-1000);
    }

    // 更新偏好
    this.updatePreferences(profile, track, rating);

    // 更新最后更新时间
    profile.lastUpdated = new Date().toISOString();

    // 保存到存储
    this.saveToStorage();

    // 记录听歌历史
  }

  /**
   * 获取用户画像
   */
  getProfile(userId: string): UserProfile | null {
    return this.profiles.get(userId) || null;
  }

  /**
   * 获取或创建用户画像
   */
  private getOrCreateProfile(userId: string): UserProfile {
    let profile = this.profiles.get(userId);

    if (!profile) {
      profile = {
        userId,
        genrePreferences: {},
        artistPreferences: {},
        featurePreferences: { ...DEFAULT_FEATURE_PREFERENCES },
        listeningHistory: [],
        lastUpdated: new Date().toISOString(),
      };
      this.profiles.set(userId, profile);
    }

    return profile;
  }

  /**
   * 提取歌曲风格
   */
  private extractGenre(track: MusicTrack): string {
    const text = `${track.title} ${track.artists.join(' ')} ${track.album || ''}`.toLowerCase();

    // 风格关键词映射
    const genreKeywords: Record<string, string[]> = {
      'pop': ['pop', '流行'],
      'rock': ['rock', '摇滚'],
      'electronic': ['electronic', 'edm', '电子', 'synth'],
      'hip-hop': ['hip-hop', 'rap', '说唱'],
      'r&b': ['r&b', 'rnb', 'soul'],
      'jazz': ['jazz', '爵士'],
      'classical': ['classical', '古典', 'piano', '钢琴'],
      'ambient': ['ambient', '环境', 'chill', 'lo-fi'],
      'folk': ['folk', '民谣', 'acoustic'],
      'metal': ['metal', '金属'],
      'country': ['country', '乡村'],
      'blues': ['blues', '蓝调'],
      'reggae': ['reggae', '雷鬼'],
      'latin': ['latin', '拉丁'],
      'world': ['world', '世界音乐'],
    };

    for (const [genre, keywords] of Object.entries(genreKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return genre;
        }
      }
    }

    return 'unknown';
  }

  /**
   * 更新用户偏好
   */
  private updatePreferences(profile: UserProfile, track: MusicTrack, rating?: number): void {
    // 计算权重（评分越高权重越大）
    const weight = rating ? rating / 5 : 0.5;

    // 更新风格偏好
    const genre = this.extractGenre(track);
    profile.genrePreferences[genre] = (profile.genrePreferences[genre] || 0) * 0.9 + weight * 0.1;

    // 更新艺术家偏好
    for (const artist of track.artists) {
      profile.artistPreferences[artist] = (profile.artistPreferences[artist] || 0) * 0.9 + weight * 0.1;
    }

    // 更新特征偏好
    const trackFeatures = this.featureExtractor.extractFeatures(track);
    const featureKeys = ['bpm', 'energy', 'valence', 'danceability', 'instrumentalness'] as const;

    for (const key of featureKeys) {
      const currentValue = profile.featurePreferences[key];
      const trackValue = trackFeatures[key];

      if (key === 'bpm') {
        // BPM 使用加权平均
        profile.featurePreferences.bpm = (currentValue * 0.9 + trackValue * 0.1);
      } else {
        // 其他特征使用加权平均
        profile.featurePreferences[key] = (currentValue * 0.9 + trackValue * 0.1);
      }
    }
  }

  /**
   * 获取用户最常听的风格
   */
  getTopGenres(userId: string, limit: number = 5): Array<{ genre: string; weight: number }> {
    const profile = this.profiles.get(userId);
    if (!profile) {
      return [];
    }

    const genres = Object.entries(profile.genrePreferences)
      .map(([genre, weight]) => ({ genre, weight: weight as number }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);

    return genres;
  }

  /**
   * 获取用户最常听的艺术家
   */
  getTopArtists(userId: string, limit: number = 10): Array<{ artist: string; weight: number }> {
    const profile = this.profiles.get(userId);
    if (!profile) {
      return [];
    }

    const artists = Object.entries(profile.artistPreferences)
      .map(([artist, weight]) => ({ artist, weight: weight as number }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);

    return artists;
  }

  /**
   * 计算两个用户的相似度
   */
  calculateSimilarity(userId1: string, userId2: string): number {
    const profile1 = this.profiles.get(userId1);
    const profile2 = this.profiles.get(userId2);

    if (!profile1 || !profile2) {
      return 0;
    }

    let similarity = 0;
    let count = 0;

    // 风格偏好相似度
    const allGenres = new Set([
      ...Object.keys(profile1.genrePreferences),
      ...Object.keys(profile2.genrePreferences),
    ]);

    let genreSimilarity = 0;
    let genreCount = 0;

    for (const genre of allGenres) {
      const weight1 = profile1.genrePreferences[genre] || 0;
      const weight2 = profile2.genrePreferences[genre] || 0;
      genreSimilarity += 1 - Math.abs(weight1 - weight2);
      genreCount++;
    }

    if (genreCount > 0) {
      similarity += (genreSimilarity / genreCount) * 0.4;
      count++;
    }

    // 艺术家偏好相似度
    const allArtists = new Set([
      ...Object.keys(profile1.artistPreferences),
      ...Object.keys(profile2.artistPreferences),
    ]);

    let artistSimilarity = 0;
    let artistCount = 0;

    for (const artist of allArtists) {
      const weight1 = profile1.artistPreferences[artist] || 0;
      const weight2 = profile2.artistPreferences[artist] || 0;
      artistSimilarity += 1 - Math.abs(weight1 - weight2);
      artistCount++;
    }

    if (artistCount > 0) {
      similarity += (artistSimilarity / artistCount) * 0.3;
      count++;
    }

    // 特征偏好相似度
    const featureSimilarity = this.featureExtractor.calculateSimilarity(
      profile1.featurePreferences,
      profile2.featurePreferences
    );
    similarity += featureSimilarity * 0.3;
    count++;

    return count > 0 ? similarity / count : 0;
  }

  /**
   * 从存储加载数据
   */
  private loadFromStorage(): void {
    try {
      const stored = preferenceStore.get('listeningHistory');
      if (stored) {
        const data = JSON.parse(stored as string);
        Object.entries(data).forEach(([userId, profile]) => {
          this.profiles.set(userId, profile as UserProfile);
        });
        log.info(`加载 ${this.profiles.size} 个用户画像`);
      }
    } catch (e) {
      log.error(`加载失败: ${e}`);
    }
  }

  /**
   * 保存数据到存储
   */
  private saveToStorage(): void {
    try {
      const data: Record<string, UserProfile> = {};
      this.profiles.forEach((profile, userId) => {
        data[userId] = profile;
      });
      preferenceStore.set('listeningHistory', JSON.stringify(data));
    } catch (e) {
      log.error(`保存失败: ${e}`);
    }
  }

  /**
   * 重置用户画像
   */
  resetProfile(userId: string): void {
    const anonymousId = this.getAnonymousId(userId);
    this.profiles.delete(anonymousId);
    this.userIdMapping.delete(userId);
    this.saveToStorage();
    log.info(`重置画像: ${userId}`);
  }

  /**
   * 获取所有用户画像
   */
  getAllProfiles(): Map<string, UserProfile> {
    return new Map(this.profiles);
  }

  // ── 隐私保护方法 ──

  /**
   * 获取匿名用户 ID
   */
  private getAnonymousId(userId: string): string {
    if (!PRIVACY_CONFIG.anonymizeUserId) {
      return userId;
    }

    let anonymousId = this.userIdMapping.get(userId);
    if (!anonymousId) {
      // 使用哈希生成匿名 ID
      const hash = createHash('sha256')
        .update(userId + PRIVACY_CONFIG.hashSalt)
        .digest('hex');
      anonymousId = `user_${hash.slice(0, 16)}`;
      this.userIdMapping.set(userId, anonymousId);
    }

    return anonymousId;
  }

  /**
   * 导出用户数据（GDPR 合规）
   */
  exportUserData(userId: string): UserProfile | null {
    const anonymousId = this.getAnonymousId(userId);
    const profile = this.profiles.get(anonymousId);

    if (!profile) {
      return null;
    }

    // 返回用户数据的副本
    return {
      ...profile,
      listeningHistory: [...profile.listeningHistory],
      genrePreferences: { ...profile.genrePreferences },
      artistPreferences: { ...profile.artistPreferences },
      featurePreferences: { ...profile.featurePreferences },
    };
  }

  /**
   * 清理过期数据
   */
  cleanupExpiredData(): void {
    const now = new Date();
    const maxAge = PRIVACY_CONFIG.maxHistoryDays * 24 * 60 * 60 * 1000;

    for (const [userId, profile] of this.profiles) {
      // 清理过期的听歌记录
      profile.listeningHistory = profile.listeningHistory.filter((record: ListeningRecord) => {
        const recordTime = new Date(record.timestamp).getTime();
        return now.getTime() - recordTime < maxAge;
      });

      // 限制记录数量
      if (profile.listeningHistory.length > PRIVACY_CONFIG.dataRetentionCount) {
        profile.listeningHistory = profile.listeningHistory.slice(-PRIVACY_CONFIG.dataRetentionCount);
      }

      // 更新最后更新时间
      profile.lastUpdated = now.toISOString();
    }

    this.saveToStorage();
    log.info('过期数据已清理');
  }

  /**
   * 删除用户数据（GDPR 合规）
   */
  deleteUserData(userId: string): boolean {
    const anonymousId = this.getAnonymousId(userId);
    const existed = this.profiles.has(anonymousId);

    this.profiles.delete(anonymousId);
    this.userIdMapping.delete(userId);
    this.saveToStorage();

    if (existed) {
      log.info(`删除用户数据: ${userId}`);
    }

    return existed;
  }

  /**
   * 获取隐私政策信息
   */
  getPrivacyInfo(): {
    dataCollected: string[];
    dataUsage: string[];
    retentionPeriod: string;
    userRights: string[];
  } {
    return {
      dataCollected: [
        '听歌历史（歌曲名称、艺术家、时长）',
        '风格偏好（基于听歌行为推断）',
        '艺术家偏好（基于听歌行为推断）',
        '音频特征偏好（基于听歌行为推断）',
      ],
      dataUsage: [
        '生成个性化推荐',
        '计算用户相似度（匿名化）',
        '改进推荐算法',
      ],
      retentionPeriod: `${PRIVACY_CONFIG.maxHistoryDays} 天`,
      userRights: [
        '查看个人数据',
        '导出个人数据',
        '删除个人数据',
        '重置学习数据',
      ],
    };
  }
}
