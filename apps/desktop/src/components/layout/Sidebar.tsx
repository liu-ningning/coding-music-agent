import { useState, useCallback, useRef, useEffect } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { useAgentStore } from '@/stores/agentStore';
import { useMusicStore } from '@/stores/musicStore';
import { useSidecarStore } from '@/stores/sidecarStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { createSession } from '@/clients/sessionClient';
import { fetchRecommendation, autoPlayRecommendation } from '@/clients/musicClient';
import { debugInfo, debugWarn } from '@/utils/debugLogger';
import logoSvg from '@/assets/logo.svg';
import { IconChat, IconFolder, IconSettings, IconLock, IconClose, IconCheck } from '@/components/common/Icons';
import s from '@/styles/layout.module.css';

// 检测是否在 Tauri 环境中
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  sessionId: string;
}

interface SidebarProps {
  sessionSearchActive?: boolean;
  onSessionSearchClose?: () => void;
}

export function Sidebar({ sessionSearchActive, onSessionSearchClose }: SidebarProps) {
  const current = useSessionStore((st) => st.current);
  const recent = useSessionStore((st) => st.recent);
  const pinnedIds = useSessionStore((st) => st.pinnedIds);
  const setCurrent = useSessionStore((st) => st.setCurrent);
  const removeSession = useSessionStore((st) => st.removeSession);
  const updateSession = useSessionStore((st) => st.updateSession);
  const togglePin = useSessionStore((st) => st.togglePin);
  const sidecarStatus = useSidecarStore((st) => st.status);
  const toggleSettings = useSettingsStore((st) => st.toggleSettings);
  const togglePermissions = useSettingsStore((st) => st.togglePermissions);

  // 会话右键菜单状态
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0, sessionId: '' });
  // 删除确认弹窗
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  // 重命名状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // 搜索框激活时自动聚焦
  useEffect(() => {
    if (sessionSearchActive) {
      setSearchQuery('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [sessionSearchActive]);

  // 过滤后的 Session 列表（置顶优先）
  const filteredRecent = (() => {
    const list = searchQuery.trim()
      ? recent.filter((ses) => {
          const q = searchQuery.toLowerCase();
          return ses.title.toLowerCase().includes(q) || ses.id.toLowerCase().includes(q);
        })
      : recent;
    // 置顶的排在前面
    return [...list].sort((a, b) => {
      const aPinned = pinnedIds.has(a.id) ? 0 : 1;
      const bPinned = pinnedIds.has(b.id) ? 0 : 1;
      return aPinned - bPinned;
    });
  })();

  // 双击重命名
  const handleDoubleClick = useCallback((sessionId: string, currentTitle: string) => {
    setEditingId(sessionId);
    setEditValue(currentTitle);
  }, []);

  const handleRenameConfirm = useCallback(() => {
    if (editingId && editValue.trim()) {
      updateSession(editingId, { title: editValue.trim() });
    }
    setEditingId(null);
    setEditValue('');
  }, [editingId, editValue, updateSession]);

  const handleContextMenu = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 160);
    const y = Math.min(e.clientY, window.innerHeight - 150);
    setMenu({ visible: true, x, y, sessionId });
  }, []);

  const closeMenu = () => setMenu((m) => ({ ...m, visible: false }));

  // 删除会话（弹出确认）
  const handleDelete = () => {
    closeMenu();
    setConfirmDelete(true);
  };

  // 确认删除
  const confirmDeleteSession = () => {
    const { sessionId } = menu;
    removeSession(sessionId);
    useAgentStore.getState().clearSession(sessionId);
    useMusicStore.getState().clearSession(sessionId);
    if (current?.id === sessionId) {
      const next = recent.find((s) => s.id !== sessionId);
      if (next) setCurrent(next);
    }
    setConfirmDelete(false);
  };

  // 清空消息
  const handleClearMessages = () => {
    const { sessionId } = menu;
    useAgentStore.getState().clearSession(sessionId);
    closeMenu();
  };

  const handleNew = async (selectDirectory: boolean = false) => {
    try {
      let projectPath: string | undefined;

      // 仅在 Tauri 环境下支持目录选择
      if (selectDirectory && isTauriEnvironment()) {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          directory: true,
          multiple: false,
          title: '选择项目目录（可选）',
        });
        if (!selected) return;
        projectPath = typeof selected === 'string' ? selected : selected;
      }

      const session = await createSession(undefined, projectPath);
      debugInfo('sidebar', `会话创建: ${session.id}`);

      // 等待一小段时间确保 store 已更新
      await new Promise(resolve => setTimeout(resolve, 100));

      const rec = await fetchRecommendation();
      if (rec && rec.tracks.length > 0) {
        await autoPlayRecommendation();
      }
    } catch (e) {
      debugWarn('sidebar', `创建失败: ${e}`);
    }
  };

  return (
    <aside className={s.sidebar}>
      <div className={s.sidebarHeader}>
        <img src={logoSvg} alt="Coding Music Agent" width="28" height="28" />
        <span>Coding Music Agent</span>
      </div>
      <div className={s.sidebarNewBtnGroup}>
        <button className={s.sidebarNewBtn} onClick={() => handleNew(false)} disabled={sidecarStatus !== 'healthy'}>
          <IconChat size={14} />
          <span>快速会话</span>
        </button>
        {/* 仅在 Tauri 环境下显示目录选择按钮 */}
        {isTauriEnvironment() && (
          <button
            className={s.sidebarNewBtnDir}
            onClick={() => handleNew(true)}
            disabled={sidecarStatus !== 'healthy'}
            title="选择目录创建会话"
          >
            <IconFolder size={14} />
            <span>项目会话</span>
          </button>
        )}
      </div>
      <div className={s.sidebarList}>
        {/* 搜索框（Cmd+K 激活时显示） */}
        {sessionSearchActive && (
          <div className={s.sidebarSearchWrap}>
            <input
              ref={searchInputRef}
              className={s.sidebarSearchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索 Session..."
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  onSessionSearchClose?.();
                }
              }}
            />
            <button
              className={s.sidebarSearchClose}
              onClick={() => { setSearchQuery(''); onSessionSearchClose?.(); }}
            >
              <IconClose size={12} />
            </button>
          </div>
        )}
        <div className={s.sidebarLabel}>
          {sessionSearchActive ? `搜索结果 (${filteredRecent.length})` : 'Recent'}
        </div>
        {filteredRecent.length === 0
          ? <div className={s.sidebarLabel}>{searchQuery ? '无匹配结果' : '暂无 Session'}</div>
          : filteredRecent.map((ses) => (
            <div
              key={ses.id}
              className={`${s.sidebarItem} ${current?.id === ses.id ? s.sidebarItemActive : ''}`}
              onClick={() => setCurrent(ses)}
              onContextMenu={(e) => handleContextMenu(e, ses.id)}
              onDoubleClick={() => handleDoubleClick(ses.id, ses.title)}
            >
              <div className={s.sidebarItemTitle}>
                {pinnedIds.has(ses.id) && <span className={s.sidebarPinIcon}>📌</span>}
                {editingId === ses.id ? (
                  <input
                    className={s.sidebarRenameInput}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleRenameConfirm}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameConfirm();
                      if (e.key === 'Escape') { setEditingId(null); setEditValue(''); }
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  ses.title
                )}
              </div>
              <div className={s.sidebarItemMeta}>
                <span className={s.sidebarItemId}>{ses.id}</span>
                <SessionDuration sessionId={ses.id} />
              </div>
              {ses.projectPath && (
                <div className={s.sidebarItemPath} title={ses.projectPath}>
                  <IconFolder size={10} /> {ses.projectPath}
                </div>
              )}
            </div>
          ))
        }
      </div>
      <div className={s.sidebarFooter}>
        <button className={s.sidebarBtn} onClick={toggleSettings}>
          <IconSettings size={14} />
          <span>设置</span>
        </button>
        <button className={s.sidebarBtn} onClick={togglePermissions}>
          <IconLock size={14} />
          <span>权限 & 隐私</span>
        </button>
      </div>

      {/* 会话右键菜单 */}
      {menu.visible && (
        <div
          style={{
            position: 'fixed',
            left: menu.x,
            top: menu.y,
            zIndex: 99999,
            background: 'rgba(30,30,30,0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '6px 0',
            minWidth: 140,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: 13,
            userSelect: 'none',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem label={pinnedIds.has(menu.sessionId) ? '取消置顶' : '置顶'} onClick={() => {
            togglePin(menu.sessionId);
            closeMenu();
          }} />
          <MenuItem label="重命名" onClick={() => {
            const ses = recent.find(s => s.id === menu.sessionId);
            if (ses) handleDoubleClick(ses.id, ses.title);
            closeMenu();
          }} />
          <MenuItem label="清空消息" onClick={handleClearMessages} />
          <MenuItem label="删除会话" danger onClick={handleDelete} />
        </div>
      )}

      {/* 点击空白关闭菜单 */}
      {menu.visible && <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={closeMenu} />}

      {/* 删除确认弹窗 */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={() => setConfirmDelete(false)}>
          <div style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border-subtle)', borderRadius: 12, padding: 24, width: 320, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 8 }}>确认删除</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              删除后该会话的所有聊天记录和音乐数据将被清除，且无法恢复。
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid var(--color-border-subtle)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: 13, cursor: 'pointer' }}
                onClick={() => setConfirmDelete(false)}
              >
                取消
              </button>
              <button
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                onClick={confirmDeleteSession}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

// Session 时长显示组件（基于实际活跃时间）
function SessionDuration({ sessionId }: { sessionId: string }) {
  const [duration, setDuration] = useState('');
  const getActiveDuration = useSessionStore((st) => st.getActiveDuration);

  useEffect(() => {
    const update = () => {
      const ms = getActiveDuration(sessionId);
      const minutes = Math.floor(ms / 60000);
      if (minutes < 1) setDuration('刚刚');
      else if (minutes < 60) setDuration(`${minutes}min`);
      else {
        const hours = Math.floor(minutes / 60);
        const remainMin = minutes % 60;
        setDuration(remainMin > 0 ? `${hours}h ${remainMin}min` : `${hours}h`);
      }
    };
    update();
    const timer = setInterval(update, 10000); // 每 10 秒更新
    return () => clearInterval(timer);
  }, [sessionId, getActiveDuration]);

  const ms = getActiveDuration(sessionId);
  const isLongSession = ms > 2 * 60 * 60 * 1000; // 超过 2 小时

  return (
    <span className={`${s.sidebarItemDuration} ${isLongSession ? s.sidebarItemDurationLong : ''}`}>
      {duration}
    </span>
  );
}

// 菜单项组件
function MenuItem({ label, danger, onClick }: { label: string; danger?: boolean; onClick: () => void }) {
  return (
    <div
      style={{
        padding: '8px 16px',
        cursor: 'pointer',
        color: danger ? '#f87171' : '#e2e8f0',
        transition: 'background 100ms',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      onClick={onClick}
    >
      {label}
    </div>
  );
}
