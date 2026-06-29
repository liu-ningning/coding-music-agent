import { useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useMusicStore } from '@/stores/musicStore';
import { useAgentStore } from '@/stores/agentStore';
import { useUIAtmosphereStore } from '@/stores/uiAtmosphereStore';
import { useContextStore } from '@/stores/contextStore';
import { audioPlayer } from '@/clients/audioPlayer';
import { debugInfo, debugError } from '@/utils/debugLogger';
import { IconWarning } from '@/components/common/Icons';
import s from '@/styles/layout.module.css';
import { SIDECAR_BASE } from '@/config';

export function SettingsDrawer() {
  const { settingsOpen, closeSettings, reducedMotion, setReducedMotion, volume, setVolume, autoRecommend, setAutoRecommend, showFloatingCard, setShowFloatingCard, showDebug, setShowDebug } = useSettingsStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  if (!settingsOpen) return null;

  const Toggle = ({ active, onToggle }: { active: boolean; onToggle: () => void }) => (
    <button className={`${s.drawerToggle} ${active ? s.drawerToggleActive : ''}`} onClick={onToggle}>
      <div className={s.drawerToggleDot} />
    </button>
  );

  // 执行清除
  const doClear = async () => {
    setClearing(true);
    debugInfo('settings', '清除数据...');

    try {
      // 1. 清除 localStorage
      try { localStorage.clear(); } catch {}

      // 2. 重置所有 stores
      useSessionStore.setState({ current: null, recent: [] });
      useMusicStore.setState({ playback: { status: 'stopped', volume: 80 }, sessions: {}, activeSessionId: null });
      useAgentStore.setState({ sessions: {}, activeSessionId: null });
      useUIAtmosphereStore.setState({ currentMood: 'neutral', glowColor: 'rgba(255,255,255,0.08)', animationLevel: 'subtle', waveSpeed: 'slow' });
      useContextStore.setState({
        context: {
          sessionId: '',
          timeOfDay: 'afternoon',
          manualState: null,
          agentStatus: 'idle',
          taskType: 'unknown',
          failureCount: 0,
          sessionDurationMs: 0,
        },
      });
      useSettingsStore.setState({ reducedMotion: false, volume: 80, autoRecommend: true, showFloatingCard: true, settingsOpen: false, permissionsOpen: false });

      // 3. 通知 sidecar
      try { await fetch(`${SIDECAR_BASE}/admin/clear`, { method: 'POST' }); } catch {}

      // 4. 延迟后刷新
      setTimeout(() => { window.location.href = window.location.href; }, 100);

    } catch (e) {
      debugError('settings', `清除失败: ${e}`);
      setClearing(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <div className={s.drawerOverlay} onClick={closeSettings} />
      <div className={s.drawer}>
        <div className={s.drawerHeader}>
          <span className={s.drawerTitle}>设置</span>
          <button className={s.drawerCloseBtn} onClick={closeSettings}>✕</button>
        </div>
        <div className={s.drawerBody}>
          <div>
            <div className={s.drawerSectionTitle}>音乐</div>
            <div className={s.drawerSettingRow}>
              <span className={s.drawerSettingLabel}>音量</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{volume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                audioPlayer.setVolume(v);
              }}
              className={s.drawerRange}
              style={{
                background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${volume}%, var(--color-bg-elevated) ${volume}%, var(--color-bg-elevated) 100%)`,
              }}
            />
            <div className={s.drawerSettingRow}>
              <div>
                <span className={s.drawerSettingLabel}>自动推荐</span>
                <div className={s.drawerSettingDesc}>开启：根据 Coding 状态自动推荐并播放音乐</div>
                <div className={s.drawerSettingDesc}>关闭：需手动选择和播放音乐</div>
              </div>
              <Toggle active={autoRecommend} onToggle={() => setAutoRecommend(!autoRecommend)} />
            </div>
            <div className={s.drawerSettingRow}>
              <div>
                <span className={s.drawerSettingLabel}>显示悬浮卡片</span>
                <div className={s.drawerSettingDesc}>开启：桌面显示迷你播放控制卡片</div>
                <div className={s.drawerSettingDesc}>关闭：隐藏悬浮卡片，仅在主界面控制</div>
              </div>
              <Toggle active={showFloatingCard} onToggle={() => setShowFloatingCard(!showFloatingCard)} />
            </div>
            <div className={s.drawerSettingRow}>
              <div>
                <span className={s.drawerSettingLabel}>调试日志</span>
                <div className={s.drawerSettingDesc}>开启：左下角显示运行日志浮层（开发者用）</div>
                <div className={s.drawerSettingDesc}>关闭：隐藏调试信息</div>
              </div>
              <Toggle active={showDebug} onToggle={() => setShowDebug(!showDebug)} />
            </div>
          </div>
          <div>
            <div className={s.drawerSectionTitle}>无障碍</div>
            <div className={s.drawerSettingRow}>
              <div>
                <span className={s.drawerSettingLabel}>减少动效</span>
                <div className={s.drawerSettingDesc}>开启：关闭/减弱界面动画，适合对动效敏感的用户</div>
                <div className={s.drawerSettingDesc}>关闭：正常显示所有动画效果</div>
              </div>
              <Toggle active={reducedMotion} onToggle={() => setReducedMotion(!reducedMotion)} />
            </div>
          </div>
          <div>
            <div className={s.drawerSectionTitle}>数据</div>
            <div className={s.drawerSettingRow}>
              <span className={s.drawerSettingLabel}>本地存储</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>localStorage</span>
            </div>
            <button
              className={`${s.drawerBtn} ${s.drawerBtnDanger}`}
              style={{ marginTop: 8 }}
              onClick={() => setShowConfirm(true)}
              disabled={clearing}
            >
              {clearing ? '清除中...' : '清除所有数据'}
            </button>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              将清除所有会话、设置和缓存数据
            </div>
          </div>
          <div>
            <div className={s.drawerSectionTitle}>关于</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Coding Music Agent v0.0.1</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Tauri + React + Node.js</div>
          </div>
        </div>
      </div>

      {/* 确认弹窗 */}
      {showConfirm && (
        <div className={s.approvalOverlay} onClick={() => !clearing && setShowConfirm(false)}>
          <div className={s.approvalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={s.approvalTitle}><IconWarning size={16} /> 确认清除</div>
            <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              确定要清除所有数据吗？这将删除：
            </div>
            <ul style={{ marginBottom: 16, fontSize: 12, color: 'var(--color-text-muted)', paddingLeft: 20 }}>
              <li>所有会话和聊天记录</li>
              <li>音乐推荐和播放历史</li>
              <li>用户设置和偏好</li>
              <li>权限配置</li>
            </ul>
            <div style={{ fontSize: 12, color: 'var(--color-warning)', marginBottom: 16 }}>
              此操作不可撤销，页面将自动刷新。
            </div>
            <div className={s.approvalActions}>
              <button
                className={s.approvalApproveBtn}
                style={{ background: 'var(--color-error)' }}
                onClick={doClear}
                disabled={clearing}
              >
                {clearing ? '清除中...' : '确认清除'}
              </button>
              <button
                className={s.approvalDenyBtn}
                onClick={() => setShowConfirm(false)}
                disabled={clearing}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
