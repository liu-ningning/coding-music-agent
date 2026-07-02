import { useState } from 'react';
import type { MusicFeedbackAction, CodingMoodState } from '@music-coding/shared-types';
import { useSessionStore } from '@/stores/sessionStore';
import { useMusicStore } from '@/stores/musicStore';
import { audioPlayer } from '@/clients/audioPlayer';
import { fetchRecommendation, getCurrentMood, setSessionPreferences } from '@/clients/musicClient';
import { IconRefresh, IconTarget, IconNight, IconFire, IconMute, IconSkip, IconCheck } from '@/components/common/Icons';
import s from '@/styles/layout.module.css';
import { SIDECAR_BASE } from '@/config';

const options: { action: MusicFeedbackAction; label: string; desc: string; icon: React.ReactNode }[] = [
  { action: 'change_set', label: '换歌', desc: '更换推荐歌曲', icon: <IconRefresh size={12} /> },
  { action: 'more_focus', label: '专注', desc: '切换到更专注的音乐', icon: <IconTarget size={12} /> },
  { action: 'more_relaxed', label: '轻松', desc: '切换到更轻松的音乐', icon: <IconNight size={12} /> },
  { action: 'more_energy', label: '活力', desc: '切换到更有活力的音乐', icon: <IconFire size={12} /> },
  { action: 'less_distraction', label: '安静', desc: '降低音乐干扰', icon: <IconMute size={12} /> },
  { action: 'dislike', label: '跳过', desc: '跳过当前歌曲', icon: <IconSkip size={12} /> },
  { action: 'keep_vibe', label: '保持', desc: '保持当前氛围不变', icon: <IconCheck size={12} /> },
];

// 反馈动作对应的临时偏好映射
const feedbackToPreferences: Partial<Record<MusicFeedbackAction, string[]>> = {
  more_focus: ['focus'],
  more_relaxed: ['relaxed'],
  more_energy: ['energy'],
  less_distraction: ['calm'],
};

// 反馈动作对应的 Mood 映射
const feedbackToMood: Partial<Record<MusicFeedbackAction, CodingMoodState>> = {
  more_focus: 'feature_flow',
  more_relaxed: 'low_energy',
  more_energy: 'feature_flow',
  less_distraction: 'debug_calm',
};

export function FeedbackButtons({ recommendationId }: { recommendationId: string }) {
  const [submitted, setSubmitted] = useState<MusicFeedbackAction | null>(null);
  const [dedupHint, setDedupHint] = useState<string | null>(null);
  const session = useSessionStore((st) => st.current);
  const sessionId = session?.id;
  const playback = useMusicStore((st) => st.playback);

  const handle = async (action: MusicFeedbackAction) => {
    if (!sessionId) return;

    // 1. 记录反馈到 sidecar
    try {
      await fetch(`${SIDECAR_BASE}/music/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, recommendationId, action }),
      });
    } catch (e) {
      // 反馈记录失败，静默处理
    }

    // 2. 显示已反馈
    setSubmitted(action);
    setTimeout(() => setSubmitted(null), 1500);

    // 3. 执行对应动作
    switch (action) {
      case 'change_set':
        // 换一组：清除临时偏好，强制刷新推荐
        setSessionPreferences(null);

        // 获取已播放歌曲数量（用于去重提示）
        const playedTrackIds = useMusicStore.getState().getPlayedTrackIds(sessionId);
        const playedCount = playedTrackIds.length;

        // 换一组时，获取相似歌曲（根据当前歌曲推荐相似的）
        const currentTrackId = playback.currentTrack?.providerTrackId;
        // 排除当前歌单所有歌曲，避免重复推荐
        const currentQueue = useMusicStore.getState().sessions[sessionId]?.queue || [];
        const excludeTrackIds = currentQueue.map(t => t.providerTrackId);
        await fetchRecommendation(getCurrentMood(), true, false, currentTrackId, excludeTrackIds);

        // 显示去重提示
        if (playedCount > 0) {
          setDedupHint(`已为您过滤 ${playedCount} 首已播放歌曲`);
          setTimeout(() => setDedupHint(null), 3000);
        }

        // 自动播放新推荐的第一首
        const { sessions } = useMusicStore.getState();
        const newData = sessions[sessionId];
        if (newData?.queue.length) {
          const firstTrack = newData.queue.find((t: any) => t.playUrl) || newData.queue[0];
          await audioPlayer.playTrack(firstTrack, true);
        }
        break;

      case 'dislike':
        // 不喜欢：跳到下一首
        audioPlayer.next();
        break;

      case 'keep_vibe':
        // 保持氛围：清除临时偏好
        setSessionPreferences(null);
        break;

      case 'more_focus':
      case 'more_relaxed':
      case 'more_energy':
      case 'less_distraction':
        // 设置临时偏好（覆盖 localStorage 中的偏好）
        const prefs = feedbackToPreferences[action];
        if (prefs) {
          setSessionPreferences(prefs);
        }

        // 切换到对应 Mood 的推荐
        const targetMood = feedbackToMood[action];
        if (targetMood) {
          await fetchRecommendation(targetMood);
          const { sessions: s } = useMusicStore.getState();
          const data = s[sessionId];
          if (data?.queue.length) {
            await audioPlayer.playTrack(data.queue[0]);
          }
        }
        break;
    }
  };

  return (
    <div className={s.feedbackGroup}>
      {options.map(({ action, label, icon }) => (
        <button
          key={action}
          className={`${s.feedbackBtn} ${submitted === action ? s.feedbackBtnActive : ''}`}
          onClick={() => handle(action)}
          title={options.find(o => o.action === action)?.desc}
        >
          {submitted === action ? <><IconCheck size={10} /> 已记住</> : <>{icon} {label}</>}
        </button>
      ))}
      {/* 去重提示 */}
      {dedupHint && (
        <div className={s.dedupHint}>
          {dedupHint}
        </div>
      )}
    </div>
  );
}
