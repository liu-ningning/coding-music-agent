import { useMusicStore } from '@/stores/musicStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useUIAtmosphereStore } from '@/stores/uiAtmosphereStore';
import { useContextStore } from '@/stores/contextStore';
import { audioPlayer } from './audioPlayer';
import { debugInfo, debugWarn } from '@/utils/debugLogger';
import type { CodingMoodState, MusicRecommendation, UserManualState } from '@music-coding/shared-types';
import { SIDECAR_BASE } from '@/config';

const MODULE = 'music';

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
export async function fetchRecommendation(mood?: CodingMoodState, refresh: boolean = false): Promise<MusicRecommendation | null> {
  const { current } = useSessionStore.getState();
  const sessionId = current?.id;

  if (!sessionId) return null;

  // 如果正在获取，等待当前请求完成
  if (fetching) {
    while (fetching) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const { sessions } = useMusicStore.getState();
    return sessions[sessionId]?.recommendation || null;
  }

  const targetMood = mood || getCurrentMood();
  const preferences = getPreferences();

  fetching = true;
  currentRecommendation = null;

  try {
    const { getPlayedTrackIds } = useMusicStore.getState();
    const playedTrackIds = getPlayedTrackIds(sessionId);

    const res = await fetch(`${SIDECAR_BASE}/music/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, mood: targetMood, refresh, preferences, playedTrackIds }),
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

    // 更新 store
    const { setRecommendation, setQueue, setActiveSession } = useMusicStore.getState();
    setActiveSession(sessionId);
    setRecommendation(sessionId, recommendation);
    setQueue(sessionId, recommendation.tracks);

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
