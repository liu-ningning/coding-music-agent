import { useState, useEffect, useRef, useCallback } from 'react';
import { useMusicStore } from '@/stores/musicStore';
import { useSessionStore } from '@/stores/sessionStore';
import { audioPlayer } from '@/clients/audioPlayer';
import { fetchRecommendation } from '@/clients/musicClient';
import { RefreshIcon } from '@/components/common/RefreshIcon';
import { IconPrevious, IconPlay, IconPause, IconNext, IconTarget, IconDislike, IconMusic, IconNight } from '@/components/common/Icons';
import s from '@/styles/layout.module.css';
import { SIDECAR_BASE } from '@/config';

// 格式化时间 mm:ss
function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function MiniPlayerBar() {
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const dragTimeRef = useRef(0);

  const playback = useMusicStore((st) => st.playback);
  const sessionId = useSessionStore((st) => st.current?.id);

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

  // 点击外部关闭反馈弹窗
  useEffect(() => {
    if (!showFeedback) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (feedbackRef.current && !feedbackRef.current.contains(e.target as Node)) {
        setShowFeedback(false);
      }
    };

    // 延迟添加监听，避免当前点击立即触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFeedback]);

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
    await fetchRecommendation('neutral', true);
    const { sessions } = useMusicStore.getState();
    const data = sessions[sessionId];
    if (data?.queue.length) {
      await audioPlayer.playTrack(data.queue[0]);
    }
  };

  const handleFeedback = async (action: 'dislike' | 'more_focus' | 'more_relaxed') => {
    if (!sessionId || !rec) return;

    try {
      await fetch(`${SIDECAR_BASE}/music/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, recommendationId: rec.id, action }),
      });
    } catch {}

    if (action === 'dislike') {
      audioPlayer.next();
    } else {
      const mood = action === 'more_focus' ? 'feature_flow' : 'low_energy';
      await fetchRecommendation(mood);
      const { sessions } = useMusicStore.getState();
      const data = sessions[sessionId];
      if (data?.queue.length) {
        await audioPlayer.playTrack(data.queue[0]);
      }
    }

    setShowFeedback(false);
  };

  return (
    <footer className={s.bottomArea}>
      {/* 左侧：歌曲信息 */}
      <div className={s.playerLeft}>
        <span className={s.playerIcon}><IconMusic size={14} /></span>
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
        <button className={s.playerBtn} onClick={handleChangeSet} disabled={!sessionId} title="换一组">
          <RefreshIcon size={14} />
        </button>
        <button className={s.playerBtn} onClick={() => setShowFeedback(!showFeedback)} disabled={!sessionId} title="反馈">
          <IconTarget size={14} />
        </button>
      </div>

      {/* 快捷反馈弹出 */}
      {showFeedback && (
        <div className={s.feedbackPopup} ref={feedbackRef}>
          <button className={s.feedbackPopupBtn} onClick={() => handleFeedback('more_focus')}>
            <IconTarget size={14} />
            <span>专注</span>
          </button>
          <button className={s.feedbackPopupBtn} onClick={() => handleFeedback('more_relaxed')}>
            <IconNight size={14} />
            <span>放松</span>
          </button>
          <button className={s.feedbackPopupBtn} onClick={() => handleFeedback('dislike')}>
            <IconDislike size={14} />
            <span>跳过</span>
          </button>
        </div>
      )}
    </footer>
  );
}
