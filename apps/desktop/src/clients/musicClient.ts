import { useMusicStore } from '@/stores/musicStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useUIAtmosphereStore } from '@/stores/uiAtmosphereStore';
import { useContextStore } from '@/stores/contextStore';
import { audioPlayer } from './audioPlayer';
import { debugInfo, debugWarn } from '@/utils/debugLogger';
import type { CodingMoodState, MusicRecommendation, UserManualState } from '@music-coding/shared-types';
import { SIDECAR_BASE } from '@/config';

const MODULE = 'music';

// 带重试的 fetch（网络抖动时自动重试）
async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (i === retries) return res; // 最后一次返回原始响应，让调用方处理
      debugWarn(MODULE, `请求失败 (${res.status})，${i + 1}/${retries} 重试中...`);
    } catch (err) {
      if (i === retries) throw err;
      debugWarn(MODULE, `网络错误，${i + 1}/${retries} 重试中...`);
    }
    // 指数退避：1s, 2s
    await new Promise(r => setTimeout(r, 1000 * (i + 1)));
  }
  throw new Error('Max retries exceeded');
}

// 标记是否正在获取推荐（防止重复请求）
let fetching = false;
// 存储当前推荐结果
let currentRecommendation: MusicRecommendation | null = null;

// 临时偏好（会话级别，优先于 localStorage）
let sessionPreferences: string[] | null = null;

// 设置临时偏好（反馈操作时调用）
export function setSessionPreferences(prefs: string[] | null): void {
  sessionPreferences = prefs;
}

// 获取当前偏好（临时优先，否则从 localStorage）
function getPreferences(): string[] {
  if (sessionPreferences) return sessionPreferences;
  const saved = localStorage.getItem('musicPreferences');
  if (saved) {
    try { return JSON.parse(saved); } catch {}
  }
  return [];
}

// 手动状态 → Mood 映射
const manualStateToMood: Record<string, CodingMoodState> = {
  need_focus: 'feature_flow',
  need_relax: 'low_energy',
  need_energy: 'feature_flow',
  low_state: 'low_energy',
  emergency: 'emergency_focus',
  deep_work: 'deep_refactor',
  creative: 'feature_flow',
  reading: 'review_focus',
  debugging: 'debug_calm',
  late_night: 'late_night_flow',
  background: 'review_focus',
};

// 获取当前应该使用的 Mood（优先手动状态）
export function getCurrentMood(): CodingMoodState {
  const { manualState } = useContextStore.getState().context;
  if (manualState && manualStateToMood[manualState]) {
    return manualStateToMood[manualState];
  }
  return 'neutral';
}

// 获取推荐
export async function fetchRecommendation(mood?: CodingMoodState, refresh: boolean = false, includeDaily: boolean = true, currentTrackId?: string): Promise<MusicRecommendation | null> {
  const { current } = useSessionStore.getState();
  const sessionId = current?.id;

  if (!sessionId) return null;

  // 如果正在获取，等待当前请求完成
  if (fetching) {
    while (fetching) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const { sessions } = useMusicStore.getState();
    const existing = sessions[sessionId]?.recommendation || null;
    const existingMood = existing?.atmosphere?.mood;
    const neededMood = mood || getCurrentMood();
    // 如果请求的 mood 与已有推荐不同，重新获取（强制 refresh 避免用缓存）
    if (existingMood && existingMood !== neededMood) {
      return fetchRecommendation(mood, true, includeDaily, currentTrackId);
    }
    return existing;
  }

  const targetMood = mood || getCurrentMood();
  const preferences = getPreferences();

  fetching = true;
  currentRecommendation = null;
  useMusicStore.getState().setRecommendLoading(true);

  try {
    const { getPlayedTrackIds } = useMusicStore.getState();
    const playedTrackIds = getPlayedTrackIds(sessionId);

    const res = await fetchWithRetry(`${SIDECAR_BASE}/music/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, mood: targetMood, refresh, preferences, playedTrackIds, includeDaily, currentTrackId }),
    });

    if (!res.ok) {
      debugWarn(MODULE, `推荐请求失败: ${res.status}`);
      return null;
    }

    const recommendation: MusicRecommendation = await res.json();

    if (!recommendation.tracks || recommendation.tracks.length === 0) {
      debugWarn(MODULE, '推荐结果为空');
      return null;
    }

    const playableTracks = recommendation.tracks.filter(t => t.playUrl);
    debugInfo(MODULE, `获取 ${recommendation.tracks.length} 首, ${playableTracks.length} 可播放`);

    // 更新 store（setRecommendation 内部已设置 queue 和 mode）
    const { setRecommendation, setActiveSession } = useMusicStore.getState();
    setActiveSession(sessionId);
    setRecommendation(sessionId, recommendation);

    // 更新氛围
    const { setMood } = useUIAtmosphereStore.getState();
    setMood(recommendation.atmosphere.mood, recommendation.atmosphere);

    currentRecommendation = recommendation;
    return recommendation;
  } catch (e) {
    debugWarn(MODULE, `推荐失败: ${e}`);
    return null;
  } finally {
    fetching = false;
    useMusicStore.getState().setRecommendLoading(false);
  }
}

// 自动播放推荐的第一首
export async function autoPlayRecommendation(): Promise<void> {
  const { current } = useSessionStore.getState();
  const sessionId = current?.id;
  if (!sessionId) return;

  const { sessions } = useMusicStore.getState();
  const sessionData = sessions[sessionId];

  if (!sessionData || sessionData.queue.length === 0) return;

  const track = sessionData.queue.find(t => t.playUrl) || sessionData.queue[0];
  debugInfo(MODULE, `自动播放: ${track.title}`);

  const { addPlayedTrack } = useMusicStore.getState();
  addPlayedTrack(sessionId, track.providerTrackId);

  await audioPlayer.playTrack(track);
}

// 刷新推荐（换一组）
export async function refreshRecommendation(): Promise<void> {
  const { current } = useSessionStore.getState();
  const sessionId = current?.id;
  if (!sessionId) return;

  const mood = getCurrentMood();
  const rec = await fetchRecommendation(mood, true);
  if (rec && rec.tracks.length > 0) {
    await audioPlayer.playTrack(rec.tracks[0]);
  }
}

// ── 网易云二维码登录 ──

/**
 * 发起二维码登录
 * 返回 key 和 base64 格式的二维码图片
 */
export async function startQrAuth(): Promise<{ key: string; qrimg: string }> {
  const res = await fetch(`${SIDECAR_BASE}/music/auth/qr/create`);
  if (!res.ok) {
    throw new Error(`发起二维码登录失败: ${res.status}`);
  }
  return res.json();
}

/**
 * 轮询二维码扫码状态
 * code: 800=过期, 801=等待扫码, 802=已扫码待确认, 803=登录成功
 */
export async function checkQrAuth(key: string): Promise<{ code: number; message: string }> {
  const res = await fetch(`${SIDECAR_BASE}/music/auth/qr/check?key=${encodeURIComponent(key)}`);
  if (!res.ok) {
    throw new Error(`检查二维码状态失败: ${res.status}`);
  }
  return res.json();
}

/**
 * 退出网易云登录
 */
export async function logoutMusic(): Promise<void> {
  const res = await fetch(`${SIDECAR_BASE}/music/auth/logout`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`退出登录失败: ${res.status}`);
  }
}

/**
 * 获取网易云登录状态
 */
export async function getMusicAuthStatus(): Promise<{ connected: boolean; userId?: string; nickname?: string; avatar?: string; signature?: string; vipType?: number }> {
  const res = await fetch(`${SIDECAR_BASE}/music/status`);
  if (!res.ok) {
    throw new Error(`获取登录状态失败: ${res.status}`);
  }
  return res.json();
}
