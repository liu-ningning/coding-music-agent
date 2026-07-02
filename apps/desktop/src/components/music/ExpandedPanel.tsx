import { useState, useEffect } from 'react';
import { useMusicStore } from '@/stores/musicStore';
import { useSessionStore } from '@/stores/sessionStore';
import { audioPlayer } from '@/clients/audioPlayer';
import { FeedbackButtons } from './FeedbackButtons';
import { RecommendationPreferences } from './RecommendationPreferences';
import { IconPlay, IconPause, IconNext, IconChevronDown, IconChevronRight, IconCircleCheck, IconCircleX, IconCircle, IconLoading } from '@/components/common/Icons';
import { SIDECAR_BASE } from '@/config';
import type { TrackFeatures } from '@music-coding/shared-types';
import s from '@/styles/layout.module.css';

export function ExpandedPanel({ onClose }: { onClose: () => void }) {
  const [showPreferences, setShowPreferences] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [warmupStatus, setWarmupStatus] = useState<{
    highPriorityWarmed: boolean;
    moods: Record<string, string>;
  } | null>(null);
  const [projectInfo, setProjectInfo] = useState<{
    projectId: string;
    projectName: string;
  } | null>(null);
  const [trackFeatures, setTrackFeatures] = useState<TrackFeatures | null>(null);
  const playback = useMusicStore((st) => st.playback);
  const sessionId = useSessionStore((st) => st.current?.id);

  // 分别订阅各个状态，确保变化时能正确触发重新渲染
  const recommendation = useMusicStore((st) => {
    if (!sessionId) return null;
    return st.sessions[sessionId]?.recommendation || null;
  });
  const queue = useMusicStore((st) => {
    if (!sessionId) return [];
    return st.sessions[sessionId]?.queue || [];
  });
  const currentIndex = useMusicStore((st) => {
    if (!sessionId) return 0;
    return st.sessions[sessionId]?.currentIndex || 0;
  });

  const rec = recommendation;
  const idx = currentIndex;
  // 优先使用队列中当前索引的歌曲，确保切换歌曲时能正确更新
  const track = queue[idx] || playback.currentTrack;
  const playing = playback.status === 'playing';
  const label = rec?.atmosphere.label || 'Neutral';

  // 获取预热状态
  useEffect(() => {
    const fetchWarmupStatus = async () => {
      try {
        const res = await fetch(`${SIDECAR_BASE}/music/warmup-status`);
        if (res.ok) {
          const data = await res.json();
          setWarmupStatus(data);
        }
      } catch (e) {
        // 获取预热状态失败，静默处理
      }
    };

    fetchWarmupStatus();
    // 每 5 秒刷新一次预热状态
    const interval = setInterval(fetchWarmupStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // 获取项目信息（检查权限）
  useEffect(() => {
    const fetchProjectInfo = async () => {
      try {
        // 先检查项目上下文权限
        const permRes = await fetch(`${SIDECAR_BASE}/permissions`);
        if (permRes.ok) {
          const permData = await permRes.json();
          if (permData.projectContext === 'disabled') {
            setProjectInfo(null);
            return;
          }
        }

        const res = await fetch(`${SIDECAR_BASE}/context/project`);
        if (res.ok) {
          const data = await res.json();
          // 检查返回的数据是否启用
          if (data.enabled === false) {
            setProjectInfo(null);
            return;
          }
          if (data.projectId && data.projectName) {
            setProjectInfo({
              projectId: data.projectId,
              projectName: data.projectName,
            });
          }
        }
      } catch (e) {
        // 获取项目信息失败，静默处理
      }
    };

    fetchProjectInfo();
  }, []);

  // 获取歌曲特征
  useEffect(() => {
    // 清除旧的特征数据
    setTrackFeatures(null);

    if (!track?.providerTrackId) {
      return;
    }

    const fetchTrackFeatures = async () => {
      try {
        const res = await fetch(`${SIDECAR_BASE}/music/track-features/${track.providerTrackId}`);
        if (res.ok) {
          const data = await res.json();
          setTrackFeatures(data);
        }
      } catch (e) {
        // 获取歌曲特征失败，静默处理
      }
    };

    fetchTrackFeatures();
  }, [track?.providerTrackId, idx]);

  return (
    <>
      <div className={s.expandedOverlay} onClick={onClose} />
      <div className={s.expandedPanel}>
        {/* Header - 固定 */}
        <div className={s.expandedHeader}>
          <div>
            <div className={s.expandedHeaderTitle}>{label}</div>
            <div className={s.expandedHeaderSub}>{rec?.mode === 'smart_radio' ? '智能电台' : '智能歌单'}</div>
          </div>
          <button className={s.expandedCloseBtn} onClick={onClose}>✕</button>
        </div>

        {/* 推荐理由 - 固定 */}
        {rec?.reason && (
          <div className={s.expandedFixedSection}>
            <div className={s.expandedSectionTitle}>
              推荐理由
              {rec.contextUsed?.includes('netease+daily') && (
                <span className={s.recSourceBadge}>个性化</span>
              )}
            </div>
            <div className={s.expandedSectionContent}>{rec.reason}</div>
          </div>
        )}

        {/* 多样性分数 - 紧凑布局 */}
        {rec?.diversityScore && (
          <div className={s.expandedFixedSectionCompact}>
            <div className={s.expandedSectionTitle}>多样性</div>
            <div className={s.diversityScoreRow}>
              <span className={s.diversityScoreValue} style={{
                color: rec.diversityScore.overall >= 0.7 ? 'var(--color-success)' :
                  rec.diversityScore.overall >= 0.5 ? 'var(--color-warning)' : 'var(--color-error)',
              }}>
                {(rec.diversityScore.overall * 100).toFixed(0)}%
              </span>
              <div className={s.diversityScoreBar}>
                <div
                  className={s.diversityScoreFill}
                  style={{
                    width: `${rec.diversityScore.overall * 100}%`,
                    backgroundColor: rec.diversityScore.overall >= 0.7 ? 'var(--color-success)' :
                      rec.diversityScore.overall >= 0.5 ? 'var(--color-warning)' : 'var(--color-error)',
                  }}
                />
              </div>
              <div className={s.diversityScoreDetails}>
                <span className={s.diversityDetailItem}>艺术家 {(rec.diversityScore.artistDiversity * 100).toFixed(0)}%</span>
                <span className={s.diversityDetailItem}>专辑 {(rec.diversityScore.albumDiversity * 100).toFixed(0)}%</span>
                <span className={s.diversityDetailItem}>时长 {(rec.diversityScore.durationDiversity * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* 预热状态 - 紧凑布局 */}
        {warmupStatus && !warmupStatus.highPriorityWarmed && (
          <div className={s.expandedFixedSectionCompact}>
            <div className={s.warmupStatusRow}>
              <span className={s.warmupDot} />
              <span className={s.warmupLabel}>预热中</span>
              <div className={s.warmupProgressCompact}>
                {Object.entries(warmupStatus.moods).map(([mood, status]) => (
                  <span key={mood} className={`${s.warmupMoodCompact} ${s[`warmup${status}`]}`}>
                    {status === 'ready' ? <IconCircleCheck size={10} /> : status === 'warming' ? <IconLoading size={10} /> : status === 'failed' ? <IconCircleX size={10} /> : <IconCircle size={10} />}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 当前播放 - 固定 */}
        {track && (
          <div className={s.expandedFixedSection}>
            <div className={s.expandedSectionTitle}>当前播放</div>
            <div className={s.expandedTrackRow}>
              {track.coverUrl ? (
                <img className={s.expandedTrackCover} src={track.coverUrl} alt="" />
              ) : (
                <div className={s.expandedTrackCoverPlaceholder}>
                  <span className={s.expandedQueueCoverLetter}>{(track.title || '?')[0]}</span>
                </div>
              )}
              <div className={s.expandedTrackInfo}>
                <div className={s.expandedTrackTitle}>{track.title}</div>
                <div className={s.expandedTrackArtist}>{track.artists.join(', ')}{track.album && ` · ${track.album}`}</div>
              </div>
              <div className={s.expandedTrackActions}>
                <button className={s.playerBtn} onClick={() => playing ? audioPlayer.pause() : audioPlayer.resume()}>
                  {playing ? <IconPause size={14} /> : <IconPlay size={14} />}
                </button>
                <button className={s.playerBtn} onClick={() => {
                  if (sessionId) {
                    useMusicStore.getState().nextTrack(sessionId);
                    const newIdx = useMusicStore.getState().sessions[sessionId]?.currentIndex || 0;
                    if (queue[newIdx]) audioPlayer.playTrack(queue[newIdx]);
                  }
                }}>
                  <IconNext size={14} />
                </button>
                {trackFeatures && (
                  <button className={s.featureBtn} onClick={() => setShowFeatures(!showFeatures)}>
                    {showFeatures ? '收起' : '特征'}
                  </button>
                )}
              </div>
            </div>
            {/* 歌曲特征弹窗 */}
            {showFeatures && trackFeatures && (
              <div className={s.trackFeaturesPopup}>
                <div className={s.trackFeaturesTitle}>当前播放歌曲特征</div>
                <div className={s.trackFeaturesGrid}>
                  <div className={s.trackFeatureItem}>
                    <span className={s.trackFeatureLabel}>BPM</span>
                    <span className={s.trackFeatureValue}>{Math.round(trackFeatures.bpm)}%</span>
                  </div>
                  <div className={s.trackFeatureItem}>
                    <span className={s.trackFeatureLabel}>能量</span>
                    <span className={s.trackFeatureValue}>{Math.round(trackFeatures.energy * 100)}%</span>
                  </div>
                  <div className={s.trackFeatureItem}>
                    <span className={s.trackFeatureLabel}>情绪</span>
                    <span className={s.trackFeatureValue}>{Math.round(trackFeatures.valence * 100)}%</span>
                  </div>
                  <div className={s.trackFeatureItem}>
                    <span className={s.trackFeatureLabel}>可舞性</span>
                    <span className={s.trackFeatureValue}>{Math.round(trackFeatures.danceability * 100)}%</span>
                  </div>
                  <div className={s.trackFeatureItem}>
                    <span className={s.trackFeatureLabel}>器乐度</span>
                    <span className={s.trackFeatureValue}>{Math.round(trackFeatures.instrumentalness * 100)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 队列 - 可滚动区域 */}
        <div className={s.expandedScrollSection}>
          {queue.length > 0 ? (
            <>
              <div className={s.expandedSectionTitle}>队列 · {queue.length} 首</div>
              <div className={s.expandedQueueList}>
                {queue.map((t, i) => {
                  const isActive = i === idx;
                  return (
                    <div
                      key={t.id}
                      className={`${s.expandedQueueItem} ${isActive ? s.expandedQueueItemActive : ''}`}
                      onClick={() => {
                        if (sessionId) {
                          useMusicStore.getState().setCurrentIndex(sessionId, i);
                        }
                        audioPlayer.playTrack(t);
                      }}
                    >
                      {t.coverUrl ? (
                        <img className={s.expandedQueueCover} src={t.coverUrl} alt="" loading="lazy" />
                      ) : (
                        <div className={s.expandedQueueCoverPlaceholder}>
                          <span className={s.expandedQueueCoverLetter}>{(t.title || '?')[0]}</span>
                        </div>
                      )}
                      <span className={`${s.expandedQueueIndex} ${isActive ? s.expandedQueueActive : ''}`}>
                        {i + 1}
                      </span>
                      <div className={s.expandedQueueInfo}>
                        <span className={`${s.expandedQueueTitle} ${isActive ? s.expandedQueueActive : ''}`}>{t.title}</span>
                        <span className={s.expandedQueueArtist}>{t.artists.join(', ')}</span>
                      </div>
                      {(t.source === 'daily' || t.source === 'similar' || t.source === 'vip_replacement') && (
                        <span
                          className={s.queueSourceTag}
                          data-tooltip={
                            t.source === 'daily' ? '来自网易云每日个性化推荐'
                            : t.source === 'similar' ? '基于当前歌曲的相似推荐'
                            : 'VIP 歌曲的免费替代版本'
                          }
                        >
                          推荐
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className={s.expandedQueueEmpty}>暂无队列</div>
          )}
        </div>

        {/* 反馈 - 固定 */}
        {rec && sessionId && (
          <div className={s.expandedFeedback}>
            <div className={s.expandedSectionTitle}>反馈</div>
            <FeedbackButtons recommendationId={rec.id} />
          </div>
        )}

        {/* Footer - 固定 */}
        <div className={s.expandedFooter}>
          <button className={s.expandedFooterBtn} onClick={() => setShowPreferences(true)}>设置</button>
          <button className={s.expandedFooterBtn} onClick={onClose}>收起 ↗</button>
        </div>
      </div>

      {/* 推荐偏好设置面板 */}
      {showPreferences && (
        <RecommendationPreferences
          onSave={() => {
            // 偏好保存后可触发推荐刷新
          }}
          onClose={() => setShowPreferences(false)}
          projectId={projectInfo?.projectId}
          projectName={projectInfo?.projectName}
        />
      )}
    </>
  );
}
