import type { MusicTrack, PlaybackState } from '@music-coding/shared-types';

// 音乐授权状态
export interface MusicAuthStatus {
  connected: boolean;
  userId?: string;
  nickname?: string;
  avatar?: string;
  signature?: string;
  expiresAt?: string;
}

// 授权开始结果
export interface AuthStartResult {
  authUrl?: string;
  qrCodeUrl?: string;
  message: string;
}

// 播放列表
export interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  tracks: MusicTrack[];
}

// 创建播放列表输入
export interface CreatePlaylistInput {
  name: string;
  description?: string;
  trackIds: string[];
}

// 音乐 Provider 接口
export interface MusicProvider {
  getAuthStatus(): Promise<MusicAuthStatus>;
  startAuth(): Promise<AuthStartResult>;
  searchTracks(query: string): Promise<MusicTrack[]>;
  getDailyRecommendations(): Promise<MusicTrack[]>;
  getUserLikedTracks(): Promise<MusicTrack[]>;
  createPlaylist(input: CreatePlaylistInput): Promise<Playlist>;
  addTracksToPlaylist(playlistId: string, trackIds: string[]): Promise<void>;
  play(track: MusicTrack): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  getPlaybackState(): Promise<PlaybackState>;
}
