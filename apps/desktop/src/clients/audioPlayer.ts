import { useMusicStore } from '@/stores/musicStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { MusicTrack } from '@music-coding/shared-types';
import { SIDECAR_BASE } from '@/config';
import { debugInfo, debugWarn, debugError } from '@/utils/debugLogger';

const MODULE = 'audio';

// 检测是否在 Tauri 环境
function isTauri(): boolean {
  return typeof window !== 'undefined' && (
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    (window as any).__TAURI_INTERNALS__ !== undefined
  );
}

// 下载音频
async function downloadAudio(url: string): Promise<ArrayBuffer> {
  try {
    if (isTauri()) {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
      const response = await tauriFetch(url, { method: 'GET' });
      if (response.status !== 200) throw new Error(`Tauri HTTP ${response.status}`);
      return await response.arrayBuffer();
    }
  } catch {
    // Tauri HTTP 失败，降级到标准 fetch
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.arrayBuffer();
}

// 音频播放器
class AudioPlayerManager {
  private audio: HTMLAudioElement | null = null;
  private initialized = false;
  private currentTrackId: string | null = null;
  // 记录播放时的 sessionId
  private currentSessionId: string | null = null;
  private blobUrls: Map<string, string> = new Map();
  private endedHandled = true;
  private lastCurrentTime = -1;
  private stuckCount = 0;
  private globalPoll: ReturnType<typeof setInterval> | null = null;
  // 连续失败次数
  private consecutiveFailures = 0;
  // 最大连续失败次数
  private readonly MAX_CONSECUTIVE_FAILURES = 5;

  init() {
    if (this.initialized) return;
    this.audio = new Audio();

    // 从设置中读取音量
    try {
      const stored = localStorage.getItem('music-coding-settings');
      if (stored) {
        const settings = JSON.parse(stored);
        this.audio.volume = (settings.volume ?? 30) / 100;
      } else {
        this.audio.volume = 0.3;
      }
    } catch {
      this.audio.volume = 0.3;
    }

    this.audio.onplay = () => {
      this.endedHandled = false;
      this.lastCurrentTime = -1;
      this.stuckCount = 0;
      this.syncState('playing');
    };

    this.audio.onpause = () => {
      if (this.audio) {
        const { duration, currentTime, ended } = this.audio;
        if (ended || (duration > 0 && currentTime >= duration - 2)) return;
      }
      this.syncState('paused');
    };

    this.audio.onended = () => {
      this.handleTrackEnd();
    };

    this.audio.onerror = () => {
      this.syncState('stopped');
      setTimeout(() => this.handleTrackEnd(), 1000);
    };

    this.startGlobalPoll();
    this.initialized = true;
    debugInfo(MODULE, `初始化完成 (${isTauri() ? 'Tauri' : 'Web'})`);
  }

  // 全局轮询：检测播放结束
  private startGlobalPoll() {
    if (this.globalPoll) return;
    this.globalPoll = setInterval(() => {
      if (!this.audio || this.endedHandled) return;

      const { duration, currentTime, ended, paused, readyState } = this.audio;
      if (paused || readyState < 2) return;
      if (currentTime <= 0 || duration <= 0 || !isFinite(duration)) return;

      if (ended || currentTime >= duration - 1.5) {
        this.handleTrackEnd();
        return;
      }

      // 检测播放停滞
      if (Math.abs(currentTime - this.lastCurrentTime) < 0.1) {
        this.stuckCount++;
        if (this.stuckCount >= 8) {
          this.handleTrackEnd();
          return;
        }
      } else {
        this.stuckCount = 0;
      }
      this.lastCurrentTime = currentTime;
    }, 500);
  }

  // 统一处理曲目结束
  private async handleTrackEnd() {
    if (this.endedHandled) return;
    this.endedHandled = true;
    this.lastCurrentTime = -1;
    this.stuckCount = 0;

    try {
      this.syncState('stopped');
      await this.next();
    } catch (e) {
      debugError(MODULE, `切歌失败: ${e}`);
    }
  }

  async playTrack(track: MusicTrack) {
    if (!this.initialized) this.init();

    if (this.currentTrackId === track.id && this.audio && !this.audio.paused) return;

    this.currentTrackId = track.id;
    this.currentSessionId = useMusicStore.getState().activeSessionId;
    this.endedHandled = false;
    this.lastCurrentTime = -1;
    this.stuckCount = 0;
    this.consecutiveFailures = 0;

    const { setPlayback, playback } = useMusicStore.getState();
    setPlayback({ ...playback, currentTrack: track, status: 'playing' });

    fetch(`${SIDECAR_BASE}/music/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track }),
    }).catch(() => {});

    if (!track.playUrl) {
      debugWarn(MODULE, `无播放地址: ${track.title}`);
      return;
    }

    try {
      // 尝试直接播放 URL
      try {
        this.audio!.pause();
        this.audio!.currentTime = 0;
        this.audio!.src = track.playUrl;
        this.audio!.load();

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), 5000);
          const onCanPlay = () => { clearTimeout(timer); cleanup(); resolve(); };
          const onError = () => { clearTimeout(timer); cleanup(); reject(new Error('load error')); };
          const cleanup = () => {
            this.audio!.removeEventListener('canplay', onCanPlay);
            this.audio!.removeEventListener('error', onError);
          };
          this.audio!.addEventListener('canplay', onCanPlay, { once: true });
          this.audio!.addEventListener('error', onError, { once: true });
        });

        await this.audio!.play();
        this.consecutiveFailures = 0;
        return;
      } catch {
        // 直接播放失败，降级 blob
      }

      // 降级：blob 播放
      let blobUrl = this.blobUrls.get(track.id);
      if (!blobUrl) {
        const audioData = await downloadAudio(track.playUrl);
        const blob = new Blob([audioData], { type: 'audio/mpeg' });
        blobUrl = URL.createObjectURL(blob);
        this.blobUrls.set(track.id, blobUrl);
      }

      this.audio!.pause();
      this.audio!.currentTime = 0;
      this.audio!.src = blobUrl;
      this.audio!.load();

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('blob timeout')), 10000);
        const onCanPlay = () => { clearTimeout(timer); cleanup(); resolve(); };
        const onError = () => { clearTimeout(timer); cleanup(); reject(new Error('blob load error')); };
        const cleanup = () => {
          this.audio!.removeEventListener('canplay', onCanPlay);
          this.audio!.removeEventListener('error', onError);
        };
        this.audio!.addEventListener('canplay', onCanPlay, { once: true });
        this.audio!.addEventListener('error', onError, { once: true });
      });

      await this.audio!.play();
      this.consecutiveFailures = 0;

    } catch (e) {
      this.consecutiveFailures++;
      debugWarn(MODULE, `播放失败: ${track.title} (${this.consecutiveFailures}/${this.MAX_CONSECUTIVE_FAILURES})`);
      this.syncState('stopped');

      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        debugError(MODULE, '连续失败过多，停止自动播放');
        return;
      }

      setTimeout(() => this.handleTrackEnd(), 1000);
    }
  }

  async pause() {
    const audio = this.audio;
    if (audio && !audio.paused) audio.pause();
    this.syncState('paused');
    fetch(`${SIDECAR_BASE}/music/pause`, { method: 'POST' }).catch(() => {});
  }

  async resume() {
    const audio = this.audio;
    if (!audio) return;

    if (audio.src && audio.paused) {
      try {
        await audio.play();
      } catch {
        await new Promise(r => setTimeout(r, 100));
      }
      this.syncState(audio.paused ? 'paused' : 'playing');
      return;
    }

    if (!audio.src) {
      const { playback, activeSessionId, sessions } = useMusicStore.getState();
      if (!activeSessionId) return;
      const sessionData = sessions[activeSessionId];
      const track = playback.currentTrack || sessionData?.queue[sessionData.currentIndex];
      if (track) await this.playTrack(track);
    }
  }

  async next() {
    const sessionId = this.currentSessionId || useMusicStore.getState().activeSessionId;
    if (!sessionId) return;

    const sessions = useMusicStore.getState().sessions;
    const sessionData = sessions[sessionId];
    if (!sessionData || sessionData.queue.length === 0) return;

    useMusicStore.getState().nextTrack(sessionId);

    const updated = useMusicStore.getState().sessions[sessionId];
    const idx = updated?.currentIndex ?? 0;
    const track = updated?.queue[idx];

    if (track) await this.playTrack(track);
  }

  setVolume(v: number) {
    if (this.audio) this.audio.volume = Math.max(0, Math.min(1, v / 100));
  }

  // 清理 blob URLs，释放内存
  cleanupBlobUrls() {
    for (const [, url] of this.blobUrls) URL.revokeObjectURL(url);
    this.blobUrls.clear();
  }

  resetFailureCount() {
    this.consecutiveFailures = 0;
  }

  getProgress(): { currentTime: number; duration: number } {
    if (!this.audio) return { currentTime: 0, duration: 0 };
    return {
      currentTime: this.audio.currentTime || 0,
      duration: this.audio.duration && isFinite(this.audio.duration) ? this.audio.duration : 0,
    };
  }

  seek(time: number) {
    if (this.audio && isFinite(time)) {
      this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration || 0));
    }
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.audio;
  }

  private syncState(status: 'playing' | 'paused' | 'stopped') {
    const { playback } = useMusicStore.getState();
    useMusicStore.getState().setPlayback({
      ...playback,
      status,
      progressMs: this.audio?.currentTime ? this.audio.currentTime * 1000 : 0,
    });
  }
}

export const audioPlayer = new AudioPlayerManager();
