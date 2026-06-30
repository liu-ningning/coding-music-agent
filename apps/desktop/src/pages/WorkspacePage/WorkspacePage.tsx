import { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { AgentConsole } from '@/components/agent/AgentConsole';
import { RightPanel } from '@/components/layout/RightPanel';
import { BottomArea } from '@/components/layout/BottomArea';
import { FloatingCard } from '@/components/music/FloatingCard';
import { AmbientLayer } from '@/components/music/AmbientLayer';
import { ApprovalDialog } from '@/components/agent/ApprovalDialog';
import { SettingsDrawer } from '@/components/settings/SettingsDrawer';
import { PermissionDrawer } from '@/components/permission/PermissionDrawer';
import { FirstLaunchGuide } from '@/components/common/FirstLaunchGuide';
import { useAgentStore } from '@/stores/agentStore';
import { useMusicStore } from '@/stores/musicStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSidecarStore } from '@/stores/sidecarStore';
import { launchSidecar } from '@/clients/sidecarLauncher';
import { useSidecarHealth } from '@/hooks/useSidecarHealth';
import { fetchRecommendation } from '@/clients/musicClient';
import { loadSessionsFromStorage, initSessionSync } from '@/clients/sessionClient';
import { loadManualState } from '@/components/common/ManualStateSelector';
import { audioPlayer } from '@/clients/audioPlayer';
import { startSidecarLogStream } from '@/utils/debugLogger';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import s from '@/styles/layout.module.css';

const FIRST_LAUNCH_KEY = 'music-coding-first-launch-done';

export function WorkspacePage() {
  const [showGuide, setShowGuide] = useState(false);
  const [musicReady, setMusicReady] = useState(false);
  const [audioInited, setAudioInited] = useState(false);
  const [sessionSearchActive, setSessionSearchActive] = useState(false);
  const sessionId = useSessionStore((st) => st.current?.id);
  const showFloatingCard = useSettingsStore((st) => st.showFloatingCard);
  const sidecarStatus = useSidecarStore((st) => st.status);

  const agentData = useAgentStore((st) => {
    if (!sessionId) return null;
    return st.sessions[sessionId] || null;
  });
  const currentApproval = agentData?.currentApproval || null;

  const musicData = useMusicStore((st) => {
    if (!sessionId) return null;
    return st.sessions[sessionId] || null;
  });
  const queue = musicData?.queue || [];

  // 启动 sidecar 并加载本地数据
  useEffect(() => {
    launchSidecar();
    loadSessionsFromStorage();
    initSessionSync();
    loadManualState();

    // 应用存储的音量设置
    const { volume, theme } = useSettingsStore.getState();
    audioPlayer.setVolume(volume);
    // 应用主题
    document.documentElement.setAttribute('data-theme', theme);
  }, []);
  useSidecarHealth();

  // Sidecar 就绪后订阅日志流
  useEffect(() => {
    if (sidecarStatus === 'healthy') {
      startSidecarLogStream();
    }
  }, [sidecarStatus]);

  // 首次启动引导
  useEffect(() => {
    if (!localStorage.getItem(FIRST_LAUNCH_KEY)) setShowGuide(true);
  }, []);

  // Session 存在且 sidecar 就绪后获取推荐（考虑手动状态）
  useEffect(() => {
    if (sessionId && sidecarStatus === 'healthy' && !musicReady) {
      // 不传 mood，自动使用手动状态或默认状态
      fetchRecommendation().then((rec) => {
        if (rec && rec.tracks.length > 0) {
          setMusicReady(true);
        }
      });
    }
  }, [sessionId, sidecarStatus, musicReady]);

  // 全局快捷键
  const shortcutHandlers = useCallback(() => ({
    onNewSession: () => {
      import('@/clients/sessionClient').then(({ createSession }) => {
        createSession().then(() => fetchRecommendation());
      });
    },
    onToggleSessionSearch: () => {
      setSessionSearchActive((prev) => !prev);
    },
  }), []);
  useKeyboardShortcuts(shortcutHandlers());

  // 用户点击时初始化音频并播放（仅首次）
  const handleClick = useCallback(() => {
    if (!audioInited) {
      audioPlayer.init();
      setAudioInited(true);

      // 仅首次点击时自动播放
      if (queue.length > 0 && musicReady) {
        const { playback } = useMusicStore.getState();
        if (playback.status !== 'playing') {
          audioPlayer.playTrack(queue[0]);
        }
      }
    }
  }, [audioInited, queue, musicReady]);

  return (
    <div className={s.workspace} onClick={handleClick}>
      <AmbientLayer />
      <TopBar />
      <div className={s.mainRow}>
        <Sidebar sessionSearchActive={sessionSearchActive} onSessionSearchClose={() => setSessionSearchActive(false)} />
        <div className={s.mainContent}>
          <AgentConsole />
        </div>
        <RightPanel />
      </div>
      <BottomArea />
      {showFloatingCard && <FloatingCard />}
      {currentApproval && <ApprovalDialog approval={currentApproval} />}
      <SettingsDrawer />
      <PermissionDrawer />
      {showGuide && <FirstLaunchGuide onComplete={() => { localStorage.setItem(FIRST_LAUNCH_KEY, 'true'); setShowGuide(false); }} />}
    </div>
  );
}
