import type { MusicTrack, TrackFeatures } from '@music-coding/shared-types';

// 关键词到特征的映射
const KEYWORD_FEATURES: Record<string, Partial<TrackFeatures>> = {
  // 节奏相关
  'edm': { bpm: 128, energy: 0.8, danceability: 0.9 },
  'electronic': { bpm: 120, energy: 0.7, danceability: 0.8 },
  'dance': { bpm: 125, energy: 0.8, danceability: 0.9 },
  'pop': { bpm: 110, energy: 0.6, danceability: 0.7 },
  'rock': { bpm: 120, energy: 0.8, danceability: 0.6 },
  'hip-hop': { bpm: 95, energy: 0.7, danceability: 0.8 },
  'rap': { bpm: 100, energy: 0.7, danceability: 0.7 },
  'r&b': { bpm: 90, energy: 0.5, danceability: 0.7 },
  'jazz': { bpm: 100, energy: 0.4, danceability: 0.5, instrumentalness: 0.6 },
  'classical': { bpm: 80, energy: 0.3, instrumentalness: 0.9 },
  'ambient': { bpm: 80, energy: 0.2, instrumentalness: 0.8, valence: 0.5 },
  'lo-fi': { bpm: 85, energy: 0.3, instrumentalness: 0.7, valence: 0.4 },
  'chill': { bpm: 90, energy: 0.3, valence: 0.6, danceability: 0.5 },
  'relaxing': { bpm: 75, energy: 0.2, valence: 0.6, instrumentalness: 0.6 },
  'calm': { bpm: 70, energy: 0.2, valence: 0.5, instrumentalness: 0.7 },
  'peaceful': { bpm: 65, energy: 0.1, valence: 0.6, instrumentalness: 0.8 },
  'energetic': { bpm: 130, energy: 0.9, danceability: 0.8, valence: 0.8 },
  'upbeat': { bpm: 120, energy: 0.8, danceability: 0.7, valence: 0.8 },
  'happy': { bpm: 115, energy: 0.7, valence: 0.9, danceability: 0.7 },
  'sad': { bpm: 75, energy: 0.3, valence: 0.2, danceability: 0.3 },
  'melancholy': { bpm: 70, energy: 0.3, valence: 0.3, danceability: 0.3 },
  'dark': { bpm: 85, energy: 0.5, valence: 0.3, instrumentalness: 0.6 },
  'deep': { bpm: 80, energy: 0.4, valence: 0.4, instrumentalness: 0.7 },
  'focus': { bpm: 90, energy: 0.4, valence: 0.5, instrumentalness: 0.7 },
  'concentration': { bpm: 85, energy: 0.3, valence: 0.5, instrumentalness: 0.8 },
  'study': { bpm: 80, energy: 0.3, valence: 0.5, instrumentalness: 0.7 },
  'work': { bpm: 95, energy: 0.5, valence: 0.6, instrumentalness: 0.6 },
  'piano': { bpm: 75, energy: 0.3, valence: 0.5, instrumentalness: 0.9 },
  'guitar': { bpm: 90, energy: 0.5, valence: 0.6, instrumentalness: 0.7 },
  'acoustic': { bpm: 85, energy: 0.4, valence: 0.6, instrumentalness: 0.6 },
  'synth': { bpm: 110, energy: 0.6, danceability: 0.7, instrumentalness: 0.8 },
  'beat': { bpm: 100, energy: 0.6, danceability: 0.7, instrumentalness: 0.5 },
  'vocal': { bpm: 100, energy: 0.5, valence: 0.6, instrumentalness: 0.2 },
  'singing': { bpm: 95, energy: 0.5, valence: 0.6, instrumentalness: 0.1 },
  'instrumental': { bpm: 90, energy: 0.4, valence: 0.5, instrumentalness: 0.9 },
  'nature': { bpm: 70, energy: 0.2, valence: 0.6, instrumentalness: 0.9 },
  'rain': { bpm: 65, energy: 0.1, valence: 0.5, instrumentalness: 0.9 },
  'ocean': { bpm: 60, energy: 0.2, valence: 0.6, instrumentalness: 0.9 },
  'forest': { bpm: 65, energy: 0.1, valence: 0.6, instrumentalness: 0.9 },
  'white noise': { bpm: 0, energy: 0.1, valence: 0.5, instrumentalness: 1.0 },
  'meditation': { bpm: 60, energy: 0.1, valence: 0.5, instrumentalness: 0.9 },
  'yoga': { bpm: 70, energy: 0.2, valence: 0.6, instrumentalness: 0.8 },
  'sleep': { bpm: 55, energy: 0.1, valence: 0.4, instrumentalness: 0.9 },
};

// 默认特征值
const DEFAULT_FEATURES: TrackFeatures = {
  bpm: 100,
  energy: 0.5,
  valence: 0.5,
  danceability: 0.5,
  instrumentalness: 0.5,
};

export class FeatureExtractor {
  /**
   * 从歌曲元数据提取特征
   */
  extractFeatures(track: MusicTrack): TrackFeatures {
    const text = `${track.title} ${track.artists.join(' ')} ${track.album || ''}`.toLowerCase();
    const features = { ...DEFAULT_FEATURES };
    let matchCount = 0;

    // 匹配关键词
    for (const [keyword, keywordFeatures] of Object.entries(KEYWORD_FEATURES)) {
      if (text.includes(keyword)) {
        // 合并特征（加权平均）
        for (const [key, value] of Object.entries(keywordFeatures)) {
          const featureKey = key as keyof TrackFeatures;
          if (value !== undefined && value !== null) {
            const currentValue = features[featureKey] as number;
            const newValue = value as number;
            features[featureKey] = ((currentValue * matchCount) + newValue) / (matchCount + 1) as any;
          }
        }
        matchCount++;
      }
    }

    // 根据时长调整特征
    if (track.durationMs) {
      const durationSec = track.durationMs / 1000;
      // 较长的歌曲通常更平静
      if (durationSec > 300) { // > 5 分钟
        features.energy *= 0.9;
        features.instrumentalness *= 1.1;
      }
      // 较短的歌曲通常更有活力
      if (durationSec < 180) { // < 3 分钟
        features.energy *= 1.1;
        features.danceability *= 1.1;
      }
    }

    // 确保值在 0-1 范围内
    features.energy = Math.max(0, Math.min(1, features.energy));
    features.valence = Math.max(0, Math.min(1, features.valence));
    features.danceability = Math.max(0, Math.min(1, features.danceability));
    features.instrumentalness = Math.max(0, Math.min(1, features.instrumentalness));
    features.bpm = Math.max(0, Math.min(200, features.bpm));

    return features;
  }

  /**
   * 批量提取特征
   */
  extractFeaturesBatch(tracks: MusicTrack[]): Map<string, TrackFeatures> {
    const result = new Map<string, TrackFeatures>();

    for (const track of tracks) {
      const features = this.extractFeatures(track);
      result.set(track.providerTrackId, features);
    }

    return result;
  }

  /**
   * 计算特征相似度
   */
  calculateSimilarity(features1: TrackFeatures, features2: TrackFeatures): number {
    const weights = {
      bpm: 0.2,
      energy: 0.3,
      valence: 0.2,
      danceability: 0.15,
      instrumentalness: 0.15,
    };

    let similarity = 0;
    let totalWeight = 0;

    for (const [key, weight] of Object.entries(weights)) {
      const featureKey = key as keyof TrackFeatures;
      const diff = Math.abs(features1[featureKey] - features2[featureKey]);

      // BPM 需要特殊处理
      if (featureKey === 'bpm') {
        const bpmDiff = Math.abs(features1.bpm - features2.bpm);
        similarity += (1 - Math.min(bpmDiff / 50, 1)) * weight;
      } else {
        similarity += (1 - diff) * weight;
      }

      totalWeight += weight;
    }

    return similarity / totalWeight;
  }

  /**
   * 根据用户偏好匹配歌曲
   */
  matchPreferences(
    trackFeatures: TrackFeatures,
    preferences: string[],
    mood: string
  ): number {
    // 偏好到特征的映射
    const preferenceFeatures: Record<string, Partial<TrackFeatures>> = {
      focus: { energy: 0.4, valence: 0.5, instrumentalness: 0.7 },
      relaxed: { energy: 0.2, valence: 0.6, danceability: 0.3 },
      energy: { energy: 0.8, danceability: 0.8, valence: 0.7 },
      calm: { energy: 0.2, valence: 0.5, instrumentalness: 0.8 },
      ambient: { energy: 0.1, instrumentalness: 0.9, valence: 0.5 },
    };

    // Mood 到特征的映射
    const moodFeatures: Record<string, Partial<TrackFeatures>> = {
      feature_flow: { energy: 0.6, danceability: 0.7, valence: 0.7 },
      debug_calm: { energy: 0.3, valence: 0.5, instrumentalness: 0.7 },
      deep_refactor: { energy: 0.3, valence: 0.4, instrumentalness: 0.8 },
      review_focus: { energy: 0.2, valence: 0.5, instrumentalness: 0.9 },
      emergency_focus: { energy: 0.2, valence: 0.5, instrumentalness: 0.9 },
      low_energy: { energy: 0.2, valence: 0.6, danceability: 0.3 },
      late_night_flow: { energy: 0.3, valence: 0.4, instrumentalness: 0.7 },
      recovery_mode: { energy: 0.3, valence: 0.6, danceability: 0.4 },
      neutral: { energy: 0.5, valence: 0.5, danceability: 0.5 },
    };

    let totalScore = 0;
    let count = 0;

    // 计算偏好匹配分数
    for (const pref of preferences) {
      const prefFeatures = preferenceFeatures[pref];
      if (prefFeatures) {
        const targetFeatures: TrackFeatures = {
          ...DEFAULT_FEATURES,
          ...prefFeatures,
        };
        totalScore += this.calculateSimilarity(trackFeatures, targetFeatures);
        count++;
      }
    }

    // 计算 Mood 匹配分数
    const moodFeats = moodFeatures[mood];
    if (moodFeats) {
      const targetFeatures: TrackFeatures = {
        ...DEFAULT_FEATURES,
        ...moodFeats,
      };
      totalScore += this.calculateSimilarity(trackFeatures, targetFeatures) * 2; // Mood 权重更高
      count += 2;
    }

    return count > 0 ? totalScore / count : 0.5;
  }
}
