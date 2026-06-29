import type {
  MusicTrack,
  UserProfile,
  ListeningRecord,
} from '@music-coding/shared-types';
import { ListeningHistoryService } from '../preference/history';

// 相似用户推荐结果
export interface CollaborativeRecommendation {
  tracks: MusicTrack[];
  similarUsers: Array<{ userId: string; similarity: number }>;
  confidence: number;
}

export class CollaborativeFiltering {
  private historyService: ListeningHistoryService;

  constructor(historyService: ListeningHistoryService) {
    this.historyService = historyService;
  }

  /**
   * 找到相似用户
   */
  findSimilarUsers(userId: string, limit: number = 10): Array<{ userId: string; similarity: number }> {
    const allProfiles = this.historyService.getAllProfiles();
    const similarities: Array<{ userId: string; similarity: number }> = [];

    for (const [otherUserId] of allProfiles) {
      if (otherUserId === userId) {
        continue;
      }

      const similarity = this.historyService.calculateSimilarity(userId, otherUserId);
      if (similarity > 0.3) { // 相似度阈值
        similarities.push({ userId: otherUserId, similarity });
      }
    }

    // 按相似度排序
    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, limit);
  }

  /**
   * 基于协同过滤生成推荐
   */
  generateRecommendations(
    userId: string,
    limit: number = 20
  ): CollaborativeRecommendation {
    const similarUsers = this.findSimilarUsers(userId, 10);

    if (similarUsers.length === 0) {
      return {
        tracks: [],
        similarUsers: [],
        confidence: 0,
      };
    }

    // 收集相似用户的听歌记录
    const trackScores = new Map<string, { track: ListeningRecord; score: number }>();

    for (const { userId: similarUserId, similarity } of similarUsers) {
      const profile = this.historyService.getProfile(similarUserId);
      if (!profile) {
        continue;
      }

      // 获取相似用户最近听的歌曲
      const recentTracks = profile.listeningHistory.slice(-50);

      for (const record of recentTracks) {
        const existing = trackScores.get(record.trackId);
        const score = similarity * (record.rating ? record.rating / 5 : 0.5);

        if (existing) {
          existing.score += score;
        } else {
          trackScores.set(record.trackId, { track: record, score });
        }
      }
    }

    // 排序并返回推荐
    const sortedTracks = Array.from(trackScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // 计算置信度
    const confidence = this.calculateConfidence(similarUsers, sortedTracks.length);

    return {
      tracks: sortedTracks.map(item => this.recordToTrack(item.track)),
      similarUsers,
      confidence,
    };
  }

  /**
   * 计算推荐置信度
   */
  private calculateConfidence(
    similarUsers: Array<{ userId: string; similarity: number }>,
    trackCount: number
  ): number {
    if (similarUsers.length === 0 || trackCount === 0) {
      return 0;
    }

    // 基于相似用户数量和平均相似度
    const avgSimilarity = similarUsers.reduce((sum, u) => sum + u.similarity, 0) / similarUsers.length;
    const userFactor = Math.min(similarUsers.length / 5, 1); // 5 个相似用户达到最大
    const trackFactor = Math.min(trackCount / 10, 1); // 10 首歌达到最大

    return avgSimilarity * userFactor * trackFactor;
  }

  /**
   * 将听歌记录转换为 MusicTrack
   */
  private recordToTrack(record: ListeningRecord): MusicTrack {
    return {
      id: `track_${record.trackId}`,
      provider: 'netease',
      providerTrackId: record.trackId,
      title: record.trackName,
      artists: record.artist.split(', '),
      durationMs: record.duration,
      playable: true,
    };
  }

  /**
   * 获取用户画像统计
   */
  getUserStats(userId: string): {
    topGenres: Array<{ genre: string; weight: number }>;
    topArtists: Array<{ artist: string; weight: number }>;
    listeningCount: number;
    similarUserCount: number;
  } | null {
    const profile = this.historyService.getProfile(userId);
    if (!profile) {
      return null;
    }

    return {
      topGenres: this.historyService.getTopGenres(userId, 5),
      topArtists: this.historyService.getTopArtists(userId, 10),
      listeningCount: profile.listeningHistory.length,
      similarUserCount: this.findSimilarUsers(userId, 100).length,
    };
  }
}
