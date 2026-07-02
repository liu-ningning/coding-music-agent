import type { MusicTrack, PlaybackState } from '@music-coding/shared-types';
import type {
  MusicProvider,
  MusicAuthStatus,
  AuthStartResult,
  Playlist,
  CreatePlaylistInput,
} from './provider';
import { randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
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

// Cookie 持久化存储路径
const COOKIE_DIR = join(homedir(), '.coding-music-agent');
const COOKIE_FILE = join(COOKIE_DIR, 'netease-cookie.json');

// Cookie 存储结构
interface StoredCookie {
  cookie: string;
  userId: string;
  nickname: string;
  avatar?: string;
  signature?: string;
  vipType?: number;
  savedAt: string;
}

// 读取已保存的 cookie
function loadStoredCookie(): StoredCookie | null {
  try {
    if (!existsSync(COOKIE_FILE)) return null;
    const data = readFileSync(COOKIE_FILE, 'utf-8');
    return JSON.parse(data) as StoredCookie;
  } catch {
    return null;
  }
}

// 保存 cookie 到文件
function saveStoredCookie(cookie: StoredCookie): void {
  try {
    if (!existsSync(COOKIE_DIR)) {
      mkdirSync(COOKIE_DIR, { recursive: true });
    }
    writeFileSync(COOKIE_FILE, JSON.stringify(cookie, null, 2), 'utf-8');
    log.info('Cookie 已保存');
  } catch (e) {
    log.error(`保存 Cookie 失败: ${e}`);
  }
}

// 清除已保存的 cookie
function clearStoredCookie(): void {
  try {
    if (existsSync(COOKIE_FILE)) {
      unlinkSync(COOKIE_FILE);
      log.info('Cookie 已清除');
    }
  } catch (e) {
    log.error(`清除 Cookie 失败: ${e}`);
  }
}

export class NeteaseMusicProvider implements MusicProvider {
  private authenticated = false;
  private userId: string | null = null;
  private nickname: string | null = null;
  private avatar: string | null = null;
  private signature: string | null = null;
  private vipType: number = 0; // 0=普通用户, 1=VIP, 2=SVIP
  private cookie: string | null = null;
  private currentTrack: MusicTrack | null = null;
  private playing = false;
  private volume = 50;

  constructor() {
    // 启动时尝试恢复登录状态（异步，不阻塞构造）
    this.restoreSession().catch(() => {});
  }

  async getAuthStatus(): Promise<MusicAuthStatus> {
    if (this.authenticated && this.userId) {
      return {
        connected: true,
        userId: this.userId,
        nickname: this.nickname || 'Music Lover',
        avatar: this.avatar || undefined,
        signature: this.signature || undefined,
        vipType: this.vipType,
      };
    }
    return { connected: false };
  }

  async startAuth(): Promise<AuthStartResult> {
    return {
      authUrl: 'https://music.163.com/#/login',
      message: '请在浏览器中打开链接完成网易云音乐授权',
    };
  }

  /**
   * 生成二维码登录凭证
   * 调用 NeteaseCloudMusicApi 的 login_qr_key + login_qr_create
   */
  async createQrCode(): Promise<{ key: string; qrimg: string }> {
    const api = await getApi();

    // Step 1: 获取二维码 key
    // 返回格式: { status: 200, body: { data: { code: 200, unikey: "..." }, code: 200 } }
    const keyResult = await api.login_qr_key();

    const key = keyResult.body?.data?.unikey;
    if (!key) {
      log.error(`获取二维码 key 失败，返回数据: ${JSON.stringify(keyResult)}`);
      throw new Error('获取二维码 key 失败');
    }

    // Step 2: 根据 key 生成二维码图片（base64）
    // 返回格式: { status: 200, body: { data: { qrimg: "data:image/..." } } }
    const qrResult = await api.login_qr_create({ key, qrimg: true });

    const qrimg = qrResult.body?.data?.qrimg;
    if (!qrimg) {
      log.error(`生成二维码图片失败，返回数据: ${JSON.stringify(qrResult)}`);
      throw new Error('生成二维码图片失败');
    }

    log.info('二维码已生成');
    return { key, qrimg };
  }

  /**
   * 轮询二维码扫码状态
   * code: 800=过期, 801=等待扫码, 802=已扫码待确认, 803=登录成功
   * 返回格式: { status: 200, body: { code: 801, cookie: [...] } }
   */
  async checkQrStatus(key: string): Promise<{ code: number; cookie?: string }> {
    const api = await getApi();
    const result = await api.login_qr_check({ key });

    // 兼容返回格式
    const code = result.body?.code ?? result.code;
    const cookieArr = result.body?.cookie ?? result.cookie;

    if (code === 803) {
      // 登录成功，cookie 是数组格式，需要转换为字符串
      log.info('扫码登录成功');

      // cookie 可能是数组或字符串
      let cookieStr: string = '';
      if (Array.isArray(cookieArr)) {
        cookieStr = cookieArr.join('; ');
      } else if (typeof cookieArr === 'string') {
        cookieStr = cookieArr;
      }

      // 保存 cookie 和用户信息
      this.cookie = cookieStr;
      this.authenticated = true;

      // 尝试获取用户信息
      try {
        const profile = await this.fetchUserProfile();
        if (profile) {
          this.userId = profile.userId;
          this.nickname = profile.nickname;
          this.avatar = profile.avatar;
          this.signature = profile.signature;
          this.vipType = profile.vipType;
        }
      } catch {
        // 获取用户信息失败不影响登录
      }

      // 持久化 cookie
      saveStoredCookie({
        cookie: cookieStr,
        userId: this.userId || '',
        nickname: this.nickname || '',
        avatar: this.avatar || undefined,
        signature: this.signature || undefined,
        vipType: this.vipType,
        savedAt: new Date().toISOString(),
      });

      return { code, cookie: cookieStr };
    }

    return { code };
  }

  /**
   * 从文件恢复登录状态
   * sidecar 启动时调用
   * 返回格式: { status: 200, body: { data: { profile: { userId: ..., nickname: ... } } } }
   */
  async restoreSession(): Promise<boolean> {
    const stored = loadStoredCookie();
    if (!stored || !stored.cookie) {
      return false;
    }

    try {
      // 使用保存的 cookie 验证登录状态
      const api = await getApi();
      const result = await api.login_status({ cookie: stored.cookie });

      // 兼容返回格式
      const body = result.body || result;
      const profile = body.data?.profile || body.profile;

      if (profile) {
        this.cookie = stored.cookie;
        this.authenticated = true;
        this.userId = stored.userId || String(profile.userId || '');
        this.nickname = stored.nickname || profile.nickname || '';
        this.avatar = stored.avatar || profile.avatarUrl || null;
        this.signature = stored.signature || profile.signature || null;
        this.vipType = stored.vipType ?? 0;
        log.info(`登录状态已恢复: ${this.nickname}`);
        return true;
      } else {
        // cookie 已失效，清除
        clearStoredCookie();
        log.warn('Cookie 已失效，已清除');
        return false;
      }
    } catch (e) {
      log.error(`恢复登录状态失败: ${e}`);
      clearStoredCookie();
      return false;
    }
  }

  /**
   * 退出登录
   */
  async logout(): Promise<void> {
    this.authenticated = false;
    this.userId = null;
    this.nickname = null;
    this.avatar = null;
    this.signature = null;
    this.vipType = 0;
    this.cookie = null;
    clearStoredCookie();
    log.info('已退出登录');
  }

  /**
   * 获取用户资料（内部方法）
   * 返回格式: { status: 200, body: { code: 200, account: { id: ..., vipType: ... }, profile: { nickname: ..., signature: ... } } }
   */
  private async fetchUserProfile(): Promise<{ userId: string; nickname: string; avatar: string; signature: string; vipType: number } | null> {
    if (!this.cookie) return null;

    try {
      const api = await getApi();
      const result = await api.user_account({ cookie: this.cookie });

      // 兼容返回格式
      const body = result.body || result;
      if (body.code === 200 && body.account) {
        return {
          userId: String(body.account.id),
          nickname: body.profile?.nickname || '',
          avatar: body.profile?.avatarUrl || '',
          signature: body.profile?.signature || '',
          vipType: body.account?.vipType ?? 0, // 0=普通用户, 1=VIP, 2=SVIP
        };
      }
    } catch (e) {
      log.error(`获取用户信息失败: ${e}`);
    }
    return null;
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

  // 获取每日推荐（已登录时使用 cookie 获取个性化推荐）
  async getDailyRecommendations(): Promise<MusicTrack[]> {
    try {
      const api = await getApi();
      // 已登录时携带 cookie 获取个性化推荐
      const params: any = {};
      if (this.cookie) {
        params.cookie = this.cookie;
      }
      const result = await api.recommend_songs(params);

      if (result.status !== 200 || !result.body?.data?.dailySongs) {
        // 未登录或失败，降级到热歌榜
        log.warn(`每日推荐为空或失败，降级到热歌榜`);
        return this.getHotTracks();
      }

      const dailySongs = result.body.data.dailySongs;
      log.info(`获取每日推荐: ${dailySongs.length} 首`);
      return dailySongs.map((song: any) => this.parseSong(song));
    } catch (e) {
      log.error(`每日推荐失败: ${e}`);
      return this.getHotTracks();
    }
  }

  /**
   * 获取用户红心歌曲
   * 已登录时调用网易云 API 获取真实红心歌曲
   * 未登录时降级到热歌榜
   */
  async getUserLikedTracks(): Promise<MusicTrack[]> {
    // 未登录时降级到热歌榜
    if (!this.cookie || !this.userId) {
      return this.getHotTracks();
    }

    try {
      const api = await getApi();
      const result = await api.user_likes({
        uid: this.userId,
        cookie: this.cookie,
      });

      // 兼容返回格式
      const body = result.body || result;
      if (body.code === 200 && body.ids && body.ids.length > 0) {
        // user_likes 只返回歌曲 ID 列表，需要获取详情
        const ids = body.ids.slice(0, 50); // 限制数量
        const trackDetails = await this.getTracksByIds(ids);
        if (trackDetails.length > 0) {
          log.info(`获取红心歌曲: ${trackDetails.length} 首`);
          return trackDetails;
        }
      }

      // 降级到热歌榜
      log.warn('红心歌曲为空，降级到热歌榜');
      return this.getHotTracks();
    } catch (e) {
      log.error(`获取红心歌曲失败: ${e}`);
      return this.getHotTracks();
    }
  }

  /**
   * 根据 ID 列表获取歌曲详情
   */
  private async getTracksByIds(ids: string[]): Promise<MusicTrack[]> {
    try {
      const api = await getApi();
      const result = await api.song_detail({
        ids: ids.join(','),
      });

      // 兼容返回格式
      const body = result.body || result;
      if (body.code === 200 && body.songs) {
        return body.songs.map((song: any) => this.parseSong(song));
      }
    } catch (e) {
      log.error(`获取歌曲详情失败: ${e}`);
    }
    return [];
  }

  /**
   * 获取相似歌曲
   * 根据当前播放的歌曲推荐相似歌曲
   */
  async getSimilarTracks(trackId: string): Promise<MusicTrack[]> {
    try {
      const api = await getApi();
      const result = await api.simi_song({ id: trackId });

      // 兼容返回格式
      const body = result.body || result;
      if (body.code === 200 && body.songs) {
        log.info(`获取相似歌曲: ${body.songs.length} 首`);
        return body.songs.map((song: any) => this.parseSong(song));
      }
    } catch (e) {
      log.error(`获取相似歌曲失败: ${e}`);
    }
    return [];
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
      const params: any = { id: songId };
      if (this.cookie) {
        params.cookie = this.cookie;
      }
      const result = await api.song_url(params);

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
  async fillTrackUrls(tracks: MusicTrack[]): Promise<{ playableTracks: MusicTrack[]; vipTracks: MusicTrack[] }> {
    const ids = tracks.map(t => t.providerTrackId).join(',');
    try {
      const api = await getApi();
      // 携带 cookie 让服务端识别 VIP 身份，否则 VIP 用户拿不到 VIP 歌曲播放链接
      const params: any = { id: ids };
      if (this.cookie) {
        params.cookie = this.cookie;
      }
      const result = await api.song_url(params);

      if (result.status === 200 && result.body?.data) {
        const urlMap = new Map<string, string>();
        const songInfoMap = new Map<string, any>();

        for (const item of result.body.data) {
          const songId = String(item.id);
          if (item.url) {
            urlMap.set(songId, item.url);
          }
          songInfoMap.set(songId, item);
        }

        // 统计过滤原因
        let noUrlCount = 0;
        let vipTrialCount = 0;
        let paidTrialCount = 0;

        // 分离可播放歌曲和 VIP 歌曲
        const playableTracks: MusicTrack[] = [];
        const vipTracks: MusicTrack[] = [];

        for (const t of tracks) {
          const songInfo = songInfoMap.get(t.providerTrackId);
          const url = urlMap.get(t.providerTrackId);

          // 没有歌曲信息或 URL 的歌曲直接跳过
          if (!songInfo || !url) {
            noUrlCount++;
            continue;
          }

          // fee: 0=免费, 1=VIP, 4=付费专辑, 8=免费+VIP
          const fee = songInfo.fee ?? 0;

          // 检查是否有试听信息（freeTrialInfo 存在表示只能试听）
          const hasFreeTrial = songInfo.freeTrialInfo != null;

          // VIP 歌曲（fee=1）且只能试听，收集起来用于相似歌曲替换
          if (fee === 1 && hasFreeTrial) {
            vipTrialCount++;
            vipTracks.push(t);
            continue;
          }

          // 付费专辑（fee=4）且只能试听，同样收集
          if (fee === 4 && hasFreeTrial) {
            paidTrialCount++;
            vipTracks.push(t);
            continue;
          }

          playableTracks.push({
            ...t,
            playUrl: urlMap.get(t.providerTrackId),
            playable: true,
          });
        }

        const filteredCount = tracks.length - playableTracks.length;
        if (filteredCount > 0) {
          log.info(`过滤掉 ${filteredCount} 首歌曲: 无URL=${noUrlCount}, VIP试听=${vipTrialCount}, 付费试听=${paidTrialCount}`);
        }

        return { playableTracks, vipTracks };
      }
    } catch (e) {
      log.error(`批量获取地址失败: ${e}`);
    }
    return { playableTracks: tracks, vipTracks: [] };
  }

  // 获取歌词
  async getLyrics(songId: string): Promise<{ lrc: string; tlyric?: string } | null> {
    try {
      const api = await getApi();
      const result = await api.lyric({ id: songId });

      if (result.status === 200 && result.body) {
        const lrc = result.body.lrc?.lyric || '';
        const tlyric = result.body.tlyric?.lyric || undefined;
        return lrc ? { lrc, tlyric } : null;
      }
      return null;
    } catch (e) {
      log.error(`获取歌词失败: ${e}`);
      return null;
    }
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
    const coverUrl = song.al?.picUrl || song.album?.picUrl || song.ar?.[0]?.picUrl || undefined;

    return {
      id: `track_${song.id}`,
      provider: 'netease',
      providerTrackId: String(song.id),
      title: song.name || 'Unknown',
      artists: artists ? artists.split('/') : ['Unknown'],
      coverUrl,
      album: album || undefined,
      durationMs: song.dt || song.duration || 0,
      playable: true,
    };
  }
}
