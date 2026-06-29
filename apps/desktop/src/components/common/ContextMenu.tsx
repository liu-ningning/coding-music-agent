import { useState, useEffect, useCallback } from 'react';
import { SIDECAR_BASE } from '@/config';

interface MenuItem {
  label: string;
  shortcut?: string;
  action: () => void;
}

export function ContextMenu() {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);

  // 检测是否在 Tauri 环境
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  // 初始化时读取置顶状态
  useEffect(() => {
    if (!isTauri) return;
    import('@tauri-apps/api').then(({ window }) => {
      const win = window.getCurrentWindow();
      win.isAlwaysOnTop().then(setAlwaysOnTop).catch(() => {});
    });
  }, [isTauri]);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    // 边界修正
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setPos({ x, y });
    setVisible(true);
  }, []);

  // 点击任意位置关闭
  useEffect(() => {
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', () => setVisible(false));
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [handleContextMenu]);

  // 快捷键监听
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      // ⌘R / Ctrl+R → 刷新
      if (meta && e.key === 'r') {
        e.preventDefault();
        window.location.reload();
      }
      // ⌘T / Ctrl+T → 窗口置顶切换
      if (meta && e.key === 't') {
        e.preventDefault();
        toggleAlwaysOnTop();
      }
      // ⌘⇧R / Ctrl+Shift+R → 清除数据
      if (meta && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        clearData();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [alwaysOnTop]);

  const reload = () => {
    window.location.reload();
  };

  const toggleAlwaysOnTop = async () => {
    if (!isTauri) return;
    const { window } = await import('@tauri-apps/api');
    const win = window.getCurrentWindow();
    const next = !alwaysOnTop;
    await win.setAlwaysOnTop(next);
    setAlwaysOnTop(next);
  };

  const clearData = async () => {
    try {
      localStorage.clear();
      await fetch(`${SIDECAR_BASE}/admin/clear`, { method: 'POST' }).catch(() => {});
      await fetch(`${SIDECAR_BASE}/logs`, { method: 'DELETE' }).catch(() => {});
      window.location.reload();
    } catch {
      // 静默处理
    }
  };

  const items: MenuItem[] = [
    { label: '刷新', shortcut: '⌘R', action: reload },
    { label: alwaysOnTop ? '取消置顶' : '窗口置顶', shortcut: '⌘T', action: toggleAlwaysOnTop },
    { label: '清除数据', shortcut: '⌘⇧R', action: clearData },
  ];

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 99999,
        background: 'rgba(30,30,30,0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '6px 0',
        minWidth: 160,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 13,
        userSelect: 'none',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 16px',
            cursor: 'pointer',
            color: '#e2e8f0',
            transition: 'background 100ms',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          onClick={() => { setVisible(false); item.action(); }}
        >
          <span>{item.label}</span>
          {item.shortcut && (
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 16 }}>{item.shortcut}</span>
          )}
        </div>
      ))}
    </div>
  );
}
