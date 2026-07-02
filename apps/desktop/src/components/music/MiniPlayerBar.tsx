import { useState, useEffect, useRef, useCallback } from 'react';
import { useMusicStore } from '@/stores/musicStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { audioPlayer } from '@/clients/audioPlayer';
import { fetchRecommendation, getCurrentMood } from '@/clients/musicClient';
import { RefreshIcon } from '@/components/common/RefreshIcon';
import { IconPrevious, IconPlay, IconPause, IconNext, IconMusic, IconVolume, IconVolumeMute, IconLyrics, IconLyricsOff } from '@/components/common/Icons';
import { ExpandedPanel } from './ExpandedPanel';
import s from '@/styles/layout.module.css';
import { SIDECAR_BASE } from '@/config';

// LRC 歌词行
interface LrcLine {
  time: number;
  text: string;
}

// 解析 LRC 格式歌词
function parseLrc(lrc: string): LrcLine[] {
  const lines: LrcLine[] = [];
  for (const line of lrc.split('\n')) {
    const matches = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/g);
    if (!matches) continue;
    const text = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
    if (!text) continue;
    for (const match of matches) {
      const [, min, sec, ms] = match.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/)!;
      const time = Number(min) * 60 + Number(sec) + Number(ms) / (ms.length === 3 ? 1000 : 100);
      lines.push({ time, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}


// 格式化时间 mm:ss
function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function MiniPlayerBar() {
  const [showVolume, setShowVolume] = useState(false);
  const showExpanded = useMusicStore((st) => st.showExpandedPanel);
  const setShowExpanded = useMusicStore((st) => st.setShowExpandedPanel);
  const [showLyricsPopup, setShowLyricsPopup] = useState(false);
  const [showLyrics, setShowLyrics] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lyricLines, setLyricLines] = useState<LrcLine[]>([]);
  const [currentLyric, setCurrentLyric] = useState<string>('');
  const [currentLyricIdx, setCurrentLyricIdx] = useState(-1);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const lyricsPopupRef = useRef<HTMLDivElement>(null);
  const lyricsCurrentRef = useRef<HTMLDivElement>(null);
  const dragTimeRef = useRef(0);

  const playback = useMusicStore((st) => st.playback);
  const sessionId = useSessionStore((st) => st.current?.id);
  const volume = useSettingsStore((st) => st.volume);
  const setVolume = useSettingsStore((st) => st.setVolume);

  const sessionData = useMusicStore((st) => {
    if (!sessionId) return null;
    return st.sessions[sessionId] || null;
  });

  const rec = sessionData?.recommendation || null;
  const queue = sessionData?.queue || [];
  const idx = sessionData?.currentIndex || 0;
  const track = playback.currentTrack || queue[idx];
  const playing = playback.status === 'playing';

  // 定时更新进度
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isDragging) {
        const progress = audioPlayer.getProgress();
        setCurrentTime(progress.currentTime);
        setDuration(progress.duration);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [isDragging]);

  // 点击外部关闭音量弹窗
  useEffect(() => {
    if (!showVolume) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (volumeRef.current && !volumeRef.current.contains(e.target as Node)) {
        setShowVolume(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVolume]);

  // 点击外部关闭歌词弹窗
  useEffect(() => {
    if (!showLyricsPopup) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (lyricsPopupRef.current && !lyricsPopupRef.current.contains(e.target as Node)) {
        setShowLyricsPopup(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLyricsPopup]);

  // 打开歌词弹窗时滚动到当前行
  useEffect(() => {
    if (showLyricsPopup && lyricsCurrentRef.current) {
      lyricsCurrentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [showLyricsPopup]);

  // 获取歌词
  useEffect(() => {
    setLyricLines([]);
    setCurrentLyric('');
    if (!track?.providerTrackId) return;

    const fetchLyrics = async () => {
      try {
        const res = await fetch(`${SIDECAR_BASE}/music/lyrics/${track.providerTrackId}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.lrc) {
            setLyricLines(parseLrc(data.lrc));
          }
        }
      } catch {}
    };

    fetchLyrics();
  }, [track?.providerTrackId]);

  // 定时更新当前歌词
  useEffect(() => {
    if (lyricLines.length === 0) return;

    const timer = setInterval(() => {
      const { currentTime: ct } = audioPlayer.getProgress();
      // 找到当前时间对应的歌词行索引
      let idx = -1;
      for (let i = lyricLines.length - 1; i >= 0; i--) {
        if (ct >= lyricLines[i].time) { idx = i; break; }
      }
      setCurrentLyricIdx(idx);
      setCurrentLyric(idx >= 0 ? lyricLines[idx].text : '');
    }, 200);

    return () => clearInterval(timer);
  }, [lyricLines]);

  // 计算进度百分比
  const progressPercent = duration > 0
    ? ((isDragging ? dragTimeRef.current : currentTime) / duration) * 100
    : 0;

  // 点击进度条跳转
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || duration <= 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTime = percent * duration;
    audioPlayer.seek(seekTime);
    setCurrentTime(seekTime);
  }, [duration]);

  // 拖拽开始
  const handleDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || duration <= 0) return;
    setIsDragging(true);
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    dragTimeRef.current = percent * duration;
    setCurrentTime(dragTimeRef.current);

    const handleMouseMove = (ev: MouseEvent) => {
      if (!progressRef.current) return;
      const rect2 = progressRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect2.left) / rect2.width));
      dragTimeRef.current = pct * duration;
      setCurrentTime(dragTimeRef.current);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      audioPlayer.seek(dragTimeRef.current);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [duration]);

  const handlePlayPause = () => {
    if (playing) {
      audioPlayer.pause();
    } else {
      audioPlayer.resume();
    }
  };

  const handleNext = () => {
    if (sessionId) {
      useMusicStore.getState().nextTrack(sessionId);
      const newIdx = useMusicStore.getState().sessions[sessionId]?.currentIndex || 0;
      if (queue[newIdx]) {
        audioPlayer.playTrack(queue[newIdx]);
      }
    }
  };

  const handlePrev = () => {
    // 如果播放超过3秒，重新开始；否则上一首
    if (currentTime > 3) {
      audioPlayer.seek(0);
    } else if (sessionId) {
      const sessionData = useMusicStore.getState().sessions[sessionId];
      if (!sessionData || sessionData.queue.length === 0) return;
      const prevIdx = sessionData.currentIndex === 0
        ? sessionData.queue.length - 1
        : sessionData.currentIndex - 1;
      useMusicStore.getState().nextTrack(sessionId); // 先 next
      // 再手动设置 index（因为 nextTrack 是 +1）
      useMusicStore.setState((state) => ({
        sessions: {
          ...state.sessions,
          [sessionId]: { ...state.sessions[sessionId], currentIndex: prevIdx },
        },
      }));
      if (sessionData.queue[prevIdx]) {
        audioPlayer.playTrack(sessionData.queue[prevIdx]);
      }
    }
  };

  const handleChangeSet = async () => {
    if (!sessionId) return;
    // 换歌时，获取相似歌曲（根据当前歌曲推荐相似的）
    const currentTrackId = playback.currentTrack?.providerTrackId;
    await fetchRecommendation(getCurrentMood(), true, false, currentTrackId);
    const { sessions } = useMusicStore.getState();
    const data = sessions[sessionId];
    if (data?.queue.length) {
      await audioPlayer.playTrack(data.queue[0]);
    }
  };

  // 音量调节
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    audioPlayer.setVolume(val);
  }, [setVolume]);

  // 静音/取消静音
  const handleToggleMute = useCallback(() => {
    if (volume > 0) {
      setVolume(0);
      audioPlayer.setVolume(0);
    } else {
      setVolume(30);
      audioPlayer.setVolume(30);
    }
  }, [volume, setVolume]);

  const hasLyrics = lyricLines.length > 0;

  return (
    <>
    {showExpanded && <ExpandedPanel onClose={() => setShowExpanded(false)} />}
    <footer className={s.bottomArea}>
      <div className={s.bottomAreaMain}>
        {/* 左侧：歌曲信息 */}
        <div className={s.playerLeft}>
          {track?.coverUrl ? (
            <img className={`${s.playerCover} ${playing ? s.playerCoverSpinning : ''}`} src={track.coverUrl} alt="" />
          ) : track ? (
            <div className={`${s.playerCoverPlaceholder} ${playing ? s.playerCoverPlaceholderSpinning : ''}`}>
              <span className={s.playerCoverLetter}>{(track.title || '?')[0]}</span>
            </div>
          ) : null}
          {track ? (
            <div className={s.playerInfo}>
              <div className={s.playerTitle}>{track.title}</div>
              <div className={s.playerSub}>
                {track.artists.join(', ')}{track.album && ` · ${track.album}`}
              </div>
            </div>
          ) : (
            <div className={s.playerInfo}>
              <div className={s.playerSub}>{rec ? rec.atmosphere.label : '点击播放开始体验'}</div>
            </div>
          )}
        </div>

        {/* 中间：进度条 + 控制按钮 */}
        <div className={s.playerCenter}>
          <span className={s.playerTime}>{formatTime(isDragging ? dragTimeRef.current : currentTime)}</span>
          <div
            ref={progressRef}
            className={s.playerProgressBar}
            onClick={handleProgressClick}
            onMouseDown={handleDragStart}
          >
            <div className={s.playerProgressFill} style={{ width: `${progressPercent}%` }} />
            <div
              className={s.playerProgressThumb}
              style={{ left: `${progressPercent}%` }}
            />
          </div>
          <span className={s.playerTime}>{formatTime(duration)}</span>
          <div className={s.playerControls}>
            <button className={s.playerBtn} onClick={handlePrev} disabled={!track} title="上一首/重播">
              <IconPrevious size={14} />
            </button>
            <button className={s.playerBtn} onClick={handlePlayPause} disabled={!track} title={playing ? '暂停' : '播放'}>
              {playing ? <IconPause size={14} /> : <IconPlay size={14} />}
            </button>
            <button className={s.playerBtn} onClick={handleNext} disabled={queue.length === 0} title="下一首">
              <IconNext size={14} />
            </button>
          </div>
        </div>

        {/* 右侧：操作按钮 */}
        <div className={s.playerRight}>
          {/* 歌词行 */}
          {showLyrics && hasLyrics && currentLyric && (
            <div
              className={s.playerLyricInline}
              onClick={() => setShowLyricsPopup(!showLyricsPopup)}
              title="点击展开全部歌词"
            >
              {currentLyric}
            </div>
          )}
          {/* 歌词开关 */}
          <button
            className={`${s.playerBtn} ${showLyrics ? s.playerBtnActive : ''}`}
            onClick={() => setShowLyrics(!showLyrics)}
            title={showLyrics ? '隐藏歌词' : '显示歌词'}
          >
            {showLyrics ? <IconLyrics size={14} /> : <IconLyricsOff size={14} />}
          </button>
          {/* 音量控制 */}
          <div className={s.volumeWrap} ref={volumeRef}>
          <button
            className={s.playerBtn}
            onClick={handleToggleMute}
            onMouseEnter={() => setShowVolume(true)}
            title={volume > 0 ? `音量 ${volume}%` : '静音'}
          >
            {volume > 0 ? <IconVolume size={14} /> : <IconVolumeMute size={14} />}
          </button>
          {showVolume && (
            <div className={s.volumePopup}>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={handleVolumeChange}
                className={s.volumeSlider}
              />
              <span className={s.volumeValue}>{volume}%</span>
            </div>
          )}
        </div>
        <button className={s.playerBtn} onClick={handleChangeSet} disabled={!sessionId} title="换一组">
          <RefreshIcon size={14} />
        </button>
      </div>

      {/* 歌词弹窗 */}
      {showLyricsPopup && hasLyrics && (
        <div className={s.lyricsPopup} ref={lyricsPopupRef}>
          <div className={s.lyricsPopupHeader}>
            <span className={s.lyricsPopupTitle}>歌词</span>
            <button className={s.lyricsPopupClose} onClick={() => setShowLyricsPopup(false)}>✕</button>
          </div>
          <div className={s.lyricsPopupContent}>
            {lyricLines.map((line, i) => (
              <div
                key={i}
                className={`${s.lyricsPopupLine} ${i === currentLyricIdx ? s.lyricsPopupLineActive : ''}`}
                ref={i === currentLyricIdx ? lyricsCurrentRef : undefined}
              >
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </footer>
    </>
  );
}
