import type {
  CodingContext,
  CodingMoodState,
  MusicRecommendation,
  MusicFeedback,
  MusicTrack,
} from '@music-coding/shared-types';
import { determineMood } from './mood';
import { MusicService } from '../music/service';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

const log = createLogger('orchestrator');

// 推荐事件
export const recommendationEvents = new EventEmitter();

// 多样性评分结果
interface DiversityScore {
  overall: number;        // 总体多样性分数 (0-1)
  artistDiversity: number; // 艺术家多样性
  albumDiversity: number;  // 专辑多样性
  durationDiversity: number; // 时长多样性
  recommendations: string[]; // 改进建议
}

export class RecommendationOrchestrator {
  private musicService: MusicService;
  private lastMood: CodingMoodState = 'neutral';

  // 多样性阈值配置
  private readonly DIVERSITY_THRESHOLDS = {
    artist: 0.6,    // 艺术家多样性阈值
    album: 0.5,     // 专辑多样性阈值
    duration: 0.4,  // 时长多样性阈值
    overall: 0.5,   // 总体多样性阈值
  };

  constructor(musicService: MusicService) {
    this.musicService = musicService;
  }

  /**
   * 根据上下文生成推荐
   */
  async recommend(
    sessionId: string,
    context: CodingContext,
  ): Promise<MusicRecommendation | null> {
    // 判断当前 Mood
    const mood = determineMood(context);

    // 如果 Mood 没变化，不重新推荐
    if (mood === this.lastMood) {
      return null;
    }

    this.lastMood = mood;

    // 生成推荐
    try {
      const recommendation = await this.musicService.recommend(sessionId, mood);

      // 计算多样性分数
      if (recommendation && recommendation.tracks.length > 0) {
        const diversityScore = this.calculateDiversityScore(recommendation.tracks);
        if (diversityScore.overall < this.DIVERSITY_THRESHOLDS.overall) {
          log.warn(`多样性偏低: ${diversityScore.overall.toFixed(2)}`);
        }
      }

      // 发送事件
      recommendationEvents.emit('recommendation.ready', {
        sessionId,
        mood,
        recommendation,
      });

      return recommendation;
    } catch (err) {
      log.error(`推荐失败: ${err}`);
      return null;
    }
  }

  /**
   * 强制重新推荐（忽略 Mood 是否变化）
   */
  async forceRecommend(
    sessionId: string,
    context: CodingContext,
  ): Promise<MusicRecommendation | null> {
    const mood = determineMood(context);
    this.lastMood = mood;

    try {
      return await this.musicService.recommend(sessionId, mood);
    } catch (err) {
      log.error(`强制推荐失败: ${err}`);
      return null;
    }
  }

  /**
   * 获取当前 Mood
   */
  getCurrentMood(context: CodingContext): CodingMoodState {
    return determineMood(context);
  }

  /**
   * 获取上次的 Mood
   */
  getLastMood(): CodingMoodState {
    return this.lastMood;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.lastMood = 'neutral';
  }

  /**
   * 计算推荐结果的多样性分数
   */
  calculateDiversityScore(tracks: MusicTrack[]): DiversityScore {
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
    const artistDiversity = this.calculateArtistDiversity(tracks);

    // 计算专辑多样性
    const albumDiversity = this.calculateAlbumDiversity(tracks);

    // 计算时长多样性
    const durationDiversity = this.calculateDurationDiversity(tracks);

    // 计算总体多样性分数（加权平均）
    const overall = (
      artistDiversity * 0.5 +
      albumDiversity * 0.3 +
      durationDiversity * 0.2
    );

    // 生成改进建议
    const recommendations = this.generateDiversityRecommendations(
      artistDiversity,
      albumDiversity,
      durationDiversity
    );

    return {
      overall,
      artistDiversity,
      albumDiversity,
      durationDiversity,
      recommendations,
    };
  }

  /**
   * 计算艺术家多样性
   */
  private calculateArtistDiversity(tracks: MusicTrack[]): number {
    // 使用 artists 数组，可能有多个艺术家
    const allArtists = tracks.flatMap(t => t.artists);
    const uniqueArtists = new Set(allArtists);
    const uniqueArtistCount = uniqueArtists.size;
    const totalTracks = tracks.length;

    // 多样性 = 唯一艺术家数 / 总曲目数
    // 最大值为 1（每个曲目来自不同艺术家）
    return Math.min(uniqueArtistCount / totalTracks, 1);
  }

  /**
   * 计算专辑多样性
   */
  private calculateAlbumDiversity(tracks: MusicTrack[]): number {
    const albums = new Set(tracks.map(t => t.album).filter(Boolean));
    const uniqueAlbumCount = albums.size;
    const totalTracks = tracks.length;

    // 多样性 = 唯一专辑数 / 总曲目数
    return Math.min(uniqueAlbumCount / totalTracks, 1);
  }

  /**
   * 计算时长多样性
   */
  private calculateDurationDiversity(tracks: MusicTrack[]): number {
    const durations = tracks.map(t => t.durationMs).filter((d): d is number => d != null && d > 0);

    if (durations.length === 0) {
      return 0;
    }

    // 计算时长的标准差（单位：毫秒）
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);

    // 标准差越大，多样性越高
    // 使用归一化标准差（假设最大标准差为 120000 毫秒 = 2 分钟）
    const normalizedStdDev = Math.min(stdDev / 120000, 1);

    return normalizedStdDev;
  }

  /**
   * 生成多样性改进建议
   */
  private generateDiversityRecommendations(
    artistDiversity: number,
    albumDiversity: number,
    durationDiversity: number
  ): string[] {
    const recommendations: string[] = [];

    if (artistDiversity < this.DIVERSITY_THRESHOLDS.artist) {
      recommendations.push('增加不同艺术家的歌曲');
    }

    if (albumDiversity < this.DIVERSITY_THRESHOLDS.album) {
      recommendations.push('增加不同专辑的歌曲');
    }

    if (durationDiversity < this.DIVERSITY_THRESHOLDS.duration) {
      recommendations.push('增加不同时长的歌曲');
    }

    if (recommendations.length === 0) {
      recommendations.push('多样性良好');
    }

    return recommendations;
  }

  /**
   * 获取多样性阈值配置
   */
  getDiversityThresholds(): typeof this.DIVERSITY_THRESHOLDS {
    return { ...this.DIVERSITY_THRESHOLDS };
  }

  /**
   * 更新多样性阈值配置
   */
  updateDiversityThresholds(thresholds: Partial<typeof this.DIVERSITY_THRESHOLDS>): void {
    Object.assign(this.DIVERSITY_THRESHOLDS, thresholds);
  }
}
