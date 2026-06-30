import { useState, useEffect } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { useAgentStore } from '@/stores/agentStore';
import { useUIAtmosphereStore } from '@/stores/uiAtmosphereStore';
import { useMusicStore } from '@/stores/musicStore';
import { useSidecarStore } from '@/stores/sidecarStore';
import { useContextStore } from '@/stores/contextStore';
import { ManualStateSelector } from '@/components/common/ManualStateSelector';
import { RefreshIcon } from '@/components/common/RefreshIcon';
import { IconSunny, IconCheck, IconWarning, IconChevronDown, IconChevronRight, IconThermometer, IconPanelOpen, IconPanelClose } from '@/components/common/Icons';
import s from '@/styles/layout.module.css';
import { SIDECAR_BASE, SIDECAR_PORT } from '@/config';
import type { WeatherContext } from '@music-coding/shared-types';

// 天气图标映射（使用统一的 SVG 风格）
const weatherIcons: Record<string, React.ReactNode> = {
  '晴': <IconSunny size={14} />,
  '大部晴朗': <IconSunny size={14} />,
  '多云': <IconSunny size={14} />,
  '阴天': <IconSunny size={14} />,
  '雾': <IconSunny size={14} />,
  '雾凇': <IconSunny size={14} />,
  '小毛毛雨': <IconSunny size={14} />,
  '毛毛雨': <IconSunny size={14} />,
  '大毛毛雨': <IconSunny size={14} />,
  '小雨': <IconSunny size={14} />,
  '中雨': <IconSunny size={14} />,
  '大雨': <IconSunny size={14} />,
  '小雪': <IconSunny size={14} />,
  '中雪': <IconSunny size={14} />,
  '大雪': <IconSunny size={14} />,
  '阵雨': <IconSunny size={14} />,
  '中阵雨': <IconSunny size={14} />,
  '大阵雨': <IconSunny size={14} />,
  '雷暴': <IconSunny size={14} />,
  '雷暴伴小冰雹': <IconSunny size={14} />,
  '雷暴伴大冰雹': <IconSunny size={14} />,
  'unknown': <IconThermometer size={14} />,
};

export function RightPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [showDetail, setShowDetail] = useState<'sidecar' | 'claude' | null>(null);
  const [claudeVersion, setClaudeVersion] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [weatherRefreshed, setWeatherRefreshed] = useState(false);
  const session = useSessionStore((st) => st.current);
  const sessionId = session?.id;
  const mood = useUIAtmosphereStore((st) => st.currentMood);
  const sidecarStatus = useSidecarStore((st) => st.status);
  const sidecarVersion = useSidecarStore((st) => st.version);
  const claudeAvailable = useSidecarStore((st) => st.claudeAvailable);
  const setContextWeather = useContextStore((st) => st.setWeather);

  // 获取天气权限状态
  const fetchWeatherPermission = async () => {
    try {
      const res = await fetch(`${SIDECAR_BASE}/permissions`);
      if (res.ok) {
        const data = await res.json();
        setWeatherEnabled(data.weather === 'enabled');
      }
    } catch (e) {
      // 获取天气权限失败，静默处理
    }
  };

  // 获取 Claude 版本
  useEffect(() => {
    if (claudeAvailable && !claudeVersion) {
      fetch(`${SIDECAR_BASE}/config`)
        .then(r => r.json())
        .then(data => {
          if (data.claudeVersion) setClaudeVersion(data.claudeVersion);
        })
        .catch(() => {});
    }
  }, [claudeAvailable]);

  // 获取天气
  const fetchWeather = async () => {
    if (sidecarStatus !== 'healthy' || weatherLoading || !weatherEnabled) return;
    setWeatherLoading(true);
    setWeatherRefreshed(false);
    try {
      const res = await fetch(`${SIDECAR_BASE}/context/weather`);
      if (res.ok) {
        const data = await res.json();
        setWeather(data);
        setContextWeather(data);
        // 显示刷新成功反馈
        setWeatherRefreshed(true);
        setTimeout(() => setWeatherRefreshed(false), 2000);
      }
    } catch (e) {
      // 获取天气失败，静默处理
    } finally {
      setWeatherLoading(false);
    }
  };

  // 侧边栏打开时获取权限状态和天气
  useEffect(() => {
    if (sidecarStatus === 'healthy') {
      fetchWeatherPermission();
    }
  }, [sidecarStatus]);

  // 权限状态变化时获取天气
  useEffect(() => {
    if (sidecarStatus === 'healthy' && weatherEnabled && !weather) {
      fetchWeather();
    }
  }, [sidecarStatus, weatherEnabled]);

  // 定期轮询权限状态（实时响应权限变更）
  useEffect(() => {
    if (sidecarStatus !== 'healthy') return;
    const interval = setInterval(fetchWeatherPermission, 3000);
    return () => clearInterval(interval);
  }, [sidecarStatus]);

  const agentData = useAgentStore((st) => {
    if (!sessionId) return null;
    return st.sessions[sessionId] || null;
  });
  const runStatus = agentData?.runStatus || 'idle';

  const musicData = useMusicStore((st) => {
    if (!sessionId) return null;
    return st.sessions[sessionId] || null;
  });
  const rec = musicData?.recommendation || null;

  const moodLabel = mood.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  const statusColors: Record<string, string> = {
    idle: 'var(--color-text-muted)',
    running: 'var(--color-accent)',
    waiting_approval: 'var(--color-warning)',
    completed: 'var(--color-success)',
    failed: 'var(--color-error)',
    cancelled: 'var(--color-text-muted)',
  };

  const sidecarStatusLabel: Record<string, string> = {
    not_started: '未启动',
    starting: '启动中...',
    healthy: '已连接',
    degraded: '降级',
    crashed: '已断开',
    restarting: '重启中...',
    stopped: '已停止',
  };

  const sidecarColor = sidecarStatus === 'healthy' ? 'var(--color-success)' :
    sidecarStatus === 'starting' ? 'var(--color-warning)' : 'var(--color-error)';

  // 收起状态
  if (collapsed) {
    return (
      <aside className={s.rightPanelCollapsed}>
        <button
          className={s.rightPanelToggle}
          onClick={() => setCollapsed(false)}
          title="展开面板"
        >
          <IconPanelClose size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className={s.rightPanel}>
      {/* 收起按钮 */}
      <button
        className={s.rightPanelToggle}
        onClick={() => setCollapsed(true)}
        title="收起面板"
      >
        <IconPanelOpen size={16} />
      </button>

      {/* 天气 */}
      {weatherEnabled && (
        <div className={s.rightSection}>
          <div className={s.rightSectionTitle}>天气</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {weather ? (
              <>
                <span style={{ fontSize: 20 }}>{weatherIcons[weather.condition] || <IconThermometer size={20} />}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{weather.condition}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{weather.temperature}°C{weather.city ? ` · ${weather.city}` : ''}</div>
                </div>
                {weatherRefreshed && (
                  <span style={{ fontSize: 11, color: 'var(--color-success)', transition: 'opacity 300ms' }}>已更新</span>
                )}
                <button
                  className={s.playerBtn}
                  onClick={fetchWeather}
                  disabled={weatherLoading}
                  title="刷新天气"
                  style={{ fontSize: 12 }}
                >
                  <RefreshIcon size={12} spinning={weatherLoading} />
                </button>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconThermometer size={14} />
                <span>获取天气中...</span>
                <button
                  className={s.playerBtn}
                  onClick={fetchWeather}
                  disabled={weatherLoading || sidecarStatus !== 'healthy'}
                  title="获取天气"
                  style={{ fontSize: 12 }}
                >
                  <RefreshIcon size={12} spinning={weatherLoading} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mood 状态 */}
      <div className={s.rightSection}>
        <div className={s.rightSectionTitle}>Mood</div>
        <div className={s.moodBadge}>{moodLabel}</div>
        {rec && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>{rec.reason}</div>}
      </div>

      {/* 手动状态 */}
      <div className={s.rightSection}>
        <ManualStateSelector />
      </div>

      {/* Agent 状态 */}
      {sessionId && (
        <div className={s.rightSection}>
          <div className={s.rightSectionTitle}>Agent</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: statusColors[runStatus] || 'var(--color-text-muted)',
            }} />
            <span style={{ fontSize: 12, color: statusColors[runStatus] }}>
              {runStatus === 'idle' ? '空闲' :
               runStatus === 'running' ? '运行中' :
               runStatus === 'waiting_approval' ? '等待审批' :
               runStatus === 'completed' ? '已完成' :
               runStatus === 'failed' ? '失败' : runStatus}
            </span>
          </div>
        </div>
      )}

      {/* 服务状态 */}
      <div className={s.rightSection}>
        <div className={s.rightSectionTitle}>服务</div>

        {/* Sidecar */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 8px', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', marginBottom: 4,
            background: showDetail === 'sidecar' ? 'var(--color-bg-elevated)' : 'transparent',
          }}
          onClick={() => setShowDetail(showDetail === 'sidecar' ? null : 'sidecar')}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: sidecarColor }} />
          <span style={{ fontSize: 12, color: sidecarColor }}>
            Server: {sidecarStatusLabel[sidecarStatus] || sidecarStatus}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-muted)' }}>
            {showDetail === 'sidecar' ? <IconChevronDown size={10} /> : <IconChevronRight size={10} />}
          </span>
        </div>

        {/* Sidecar 详情 */}
        {showDetail === 'sidecar' && (
          <div style={{
            padding: '8px 12px',
            background: 'var(--color-bg-elevated)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 11, lineHeight: 1.6,
            marginBottom: 8,
          }}>
            <div style={{ color: 'var(--color-text-secondary)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>状态：</span>
              {sidecarStatusLabel[sidecarStatus] || sidecarStatus}
            </div>
            <div style={{ color: 'var(--color-text-secondary)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>版本：</span>
              {sidecarVersion || '—'}
            </div>
            <div style={{ color: 'var(--color-text-secondary)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>端口：</span>
              {SIDECAR_PORT}
            </div>
            {sidecarStatus !== 'healthy' && (
              <div style={{ marginTop: 6, color: 'var(--color-warning)' }}>
                请在终端运行：pnpm dev:sidecar
              </div>
            )}
          </div>
        )}

        {/* Claude */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 8px', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            background: showDetail === 'claude' ? 'var(--color-bg-elevated)' : 'transparent',
          }}
          onClick={() => setShowDetail(showDetail === 'claude' ? null : 'claude')}
        >
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: claudeAvailable ? 'var(--color-success)' : 'var(--color-warning)',
          }} />
          <span style={{ fontSize: 12, color: claudeAvailable ? 'var(--color-success)' : 'var(--color-warning)' }}>
            Claude: {claudeAvailable ? '已就绪' : '未安装'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-muted)' }}>
            {showDetail === 'claude' ? <IconChevronDown size={10} /> : <IconChevronRight size={10} />}
          </span>
        </div>

        {/* Claude 详情 */}
        {showDetail === 'claude' && (
          <div style={{
            padding: '8px 12px',
            background: 'var(--color-bg-elevated)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 11, lineHeight: 1.6,
          }}>
            <div style={{ color: 'var(--color-text-secondary)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>模式：</span>
              本地 CLI
            </div>
            <div style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>状态：</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {claudeAvailable ? <><IconCheck size={12} /> 已就绪</> : <><IconWarning size={12} /> 未安装</>}
              </span>
            </div>
            {claudeVersion && (
              <div style={{ color: 'var(--color-text-secondary)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>版本：</span>
                {claudeVersion}
              </div>
            )}
            {!claudeAvailable && (
              <div style={{ marginTop: 6, color: 'var(--color-warning)' }}>
                安装命令：npm i -g @anthropic-ai/claude-code
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
