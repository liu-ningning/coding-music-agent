import type { MusicTrack, PlaybackState } from '@music-coding/shared-types';
import type {
  MusicProvider,
  MusicAuthStatus,
  AuthStartResult,
  Playlist,
  CreatePlaylistInput,
} from './provider';
import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger';

const log = createLogger('netease');

// 动态导入网易云 API（运行时从 NODE_PATH 加载，不打包进 bundle）
// 启动时并发请求可能导致首次 import 失败，加重试
let neteaseApi: any = null;

async function getApi(retries = 3): Promise<any> {
  if (neteaseApi) return neteaseApi;
  for (let i = 0; i < retries; i++) {
    try {
      const module = await import('NeteaseCloudMusicApi');
      neteaseApi = module.default || module;
      return neteaseApi;
    } catch (e) {
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 500));
      } else {
        log.error(`加载 API 失败: ${e}`);
        throw new Error('NeteaseCloudMusicApi not available');
      }
    }
  }
  throw new Error('NeteaseCloudMusicApi not available');
}

export class NeteaseMusicProvider implements MusicProvider {
  private authenticated = false;
  private userId: string | null = null;
  private currentTrack: MusicTrack | null = null;
  private playing = false;
  private volume = 50;

  async getAuthStatus(): Promise<MusicAuthStatus> {
    if (this.authenticated) {
      return { connected: true, userId: this.userId || undefined, nickname: 'Music Lover' };
    }
    return { connected: false };
  }

  async startAuth(): Promise<AuthStartResult> {
    return {
      authUrl: 'https://music.163.com/#/login',
      message: '请在浏览器中打开链接完成网易云音乐授权',
    };
  }

  // 搜索歌曲
  async searchTracks(query: string): Promise<MusicTrack[]> {
    try {
      const api = await getApi();
      const result = await api.cloudsearch({ keywords: query, limit: 10 });

      if (result.status !== 200 || !result.body?.result?.songs) {
        return [];
      }

      return result.body.result.songs.map((song: any) => this.parseSong(song));
    } catch (e) {
      log.error(`搜索失败: ${e}`);
      return [];
    }
  }

  // 获取热歌榜
  async getHotTracks(): Promise<MusicTrack[]> {
    try {
      const api = await getApi();
      const result = await api.top_song({ type: 0 }); // 0 = 全部

      if (result.status !== 200 || !result.body?.data) {
        return [];
      }

      return result.body.data.slice(0, 50).map((song: any) => this.parseSong(song));
    } catch (e) {
      log.error(`热歌榜失败: ${e}`);
      return [];
    }
  }

  // 获取推荐歌单
  async getPersonalizedPlaylists(limit: number = 10): Promise<Playlist[]> {
    try {
      const api = await getApi();
      const result = await api.personalized({ limit });

      if (result.status !== 200 || !result.body?.result) {
        return [];
      }

      return result.body.result.map((p: any) => ({
        id: String(p.id),
        name: p.name,
        trackCount: p.trackCount || 0,
        tracks: [],
      }));
    } catch (e) {
      log.error(`推荐歌单失败: ${e}`);
      return [];
    }
  }

  // 获取歌单详情（包含歌曲）
  async getPlaylistTracks(playlistId: string): Promise<MusicTrack[]> {
    try {
      const api = await getApi();
      const result = await api.playlist_detail({ id: playlistId });

      if (result.status !== 200 || !result.body?.playlist?.tracks) {
        return [];
      }

      return result.body.playlist.tracks.slice(0, 30).map((song: any) => this.parseSong(song));
    } catch (e) {
      log.error(`歌单详情失败: ${e}`);
      return [];
    }
  }

  // 获取每日推荐
  async getDailyRecommendations(): Promise<MusicTrack[]> {
    try {
      const api = await getApi();
      const result = await api.recommend_songs();

      if (result.status !== 200 || !result.body?.data?.dailySongs) {
        // 未登录，降级到热歌榜
        return this.getHotTracks();
      }

      return result.body.data.dailySongs.map((song: any) => this.parseSong(song));
    } catch (e) {
      log.error(`每日推荐失败: ${e}`);
      return this.getHotTracks();
    }
  }

  async getUserLikedTracks(): Promise<MusicTrack[]> {
    return this.getHotTracks();
  }

  async createPlaylist(input: CreatePlaylistInput): Promise<Playlist> {
    return {
      id: `playlist_${randomUUID().slice(0, 8)}`,
      name: input.name,
      trackCount: input.trackIds.length,
      tracks: [],
    };
  }

  async addTracksToPlaylist(_playlistId: string, _trackIds: string[]): Promise<void> {}

  async play(track: MusicTrack): Promise<void> {
    this.currentTrack = track;
    this.playing = true;
  }

  async pause(): Promise<void> {
    this.playing = false;
  }

  async next(): Promise<void> {
    const hot = await this.getHotTracks();
    if (hot.length > 0) {
      this.currentTrack = hot[Math.floor(Math.random() * hot.length)];
      this.playing = true;
    }
  }

  async getPlaybackState(): Promise<PlaybackState> {
    return {
      status: this.playing ? 'playing' : 'paused',
      currentTrack: this.currentTrack ?? undefined,
      volume: this.volume,
    };
  }

  // 获取歌曲播放链接
  async getSongUrl(songId: string): Promise<string | null> {
    try {
      const api = await getApi();
      const result = await api.song_url({ id: songId });

      if (result.status === 200 && result.body?.data?.length > 0) {
        const url = result.body.data[0].url;
        if (url) return url;
      }
      return null;
    } catch (e) {
      log.error(`获取播放地址失败: ${e}`);
      return null;
    }
  }

  // 批量获取播放链接
  async fillTrackUrls(tracks: MusicTrack[]): Promise<MusicTrack[]> {
    const ids = tracks.map(t => t.providerTrackId).join(',');
    try {
      const api = await getApi();
      const result = await api.song_url({ id: ids });

      if (result.status === 200 && result.body?.data) {
        const urlMap = new Map<string, string>();
        for (const item of result.body.data) {
          if (item.url) urlMap.set(String(item.id), item.url);
        }

        return tracks.map(t => ({
          ...t,
          playUrl: urlMap.get(t.providerTrackId) || undefined,
          playable: urlMap.has(t.providerTrackId),
        }));
      }
    } catch (e) {
      log.error(`批量获取地址失败: ${e}`);
    }
    return tracks;
  }

  simulateLogin(): void {
    this.authenticated = true;
  }

  simulateLogout(): void {
    this.authenticated = false;
    this.currentTrack = null;
    this.playing = false;
  }

  // 解析歌曲数据
  private parseSong(song: any): MusicTrack {
    const artists = (song.ar || song.artists || []).map((a: any) => a.name).join('/');
    const album = song.al?.name || song.album?.name || '';

    return {
      id: `track_${song.id}`,
      provider: 'netease',
      providerTrackId: String(song.id),
      title: song.name || 'Unknown',
      artists: artists ? artists.split('/') : ['Unknown'],
      album: album || undefined,
      durationMs: song.dt || song.duration || 0,
      playable: true,
    };
  }
}
