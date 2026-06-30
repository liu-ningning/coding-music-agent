import { useEffect } from 'react';
import { audioPlayer } from '@/clients/audioPlayer';
import { useMusicStore } from '@/stores/musicStore';
import { useSettingsStore } from '@/stores/settingsStore';

interface ShortcutHandlers {
  onNewSession?: () => void;
  onToggleSessionSearch?: () => void;
}

/**
 * 全局快捷键 hook
 * - Cmd/Ctrl + N: 新建 Session
 * - Cmd/Ctrl + K: 切换 Session（触发搜索）
 * - Cmd/Ctrl + Shift + M: 静音/取消静音
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + N: 新建 Session
      if (isMod && e.key === 'n') {
        e.preventDefault();
        handlers.onNewSession?.();
        return;
      }

      // Cmd/Ctrl + K: 切换 Session（触发搜索）
      if (isMod && e.key === 'k') {
        e.preventDefault();
        handlers.onToggleSessionSearch?.();
        return;
      }

      // Cmd/Ctrl + Shift + M: 静音/取消静音
      if (isMod && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        toggleMute();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}

/**
 * Agent Console 专用快捷键
 * - Cmd/Ctrl + Enter: 发送消息（在输入框内）
 */
export function useConsoleShortcuts(onSend: () => void) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter: 发送
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSend();
    }
  };

  return handleKeyDown;
}

// 静音状态记录（避免每次都读 store）
let lastVolume = 30;

function toggleMute() {
  const { volume, setVolume } = useSettingsStore.getState();

  if (volume > 0) {
    // 当前有音量 → 静音
    lastVolume = volume;
    setVolume(0);
    audioPlayer.setVolume(0);
  } else {
    // 当前静音 → 恢复
    const restore = lastVolume > 0 ? lastVolume : 30;
    setVolume(restore);
    audioPlayer.setVolume(restore);
  }
}
