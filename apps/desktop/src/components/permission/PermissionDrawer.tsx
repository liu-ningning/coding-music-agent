import { useState, useEffect, useCallback, useRef } from 'react';
import type { PermissionState } from '@music-coding/shared-types';
import { useSettingsStore } from '@/stores/settingsStore';
import { IconCheck, IconDisabled } from '@/components/common/Icons';
import { startQrAuth, checkQrAuth, logoutMusic, getMusicAuthStatus } from '@/clients/musicClient';
import s from '@/styles/layout.module.css';
import { SIDECAR_BASE } from '@/config';
import { debugInfo, debugWarn } from '@/utils/debugLogger';

const MODULE = 'permission';

const perms = [
  {
    key: 'weather' as const,
    label: '天气感知',
    reads: '当前天气状况（温度、天气类型）',
    why: '根据天气自动调整界面氛围和音乐风格',
    risk: 'low' as const,
    enabledDesc: '应用会读取本地天气数据，雨天推荐舒缓音乐，晴天推荐明快节奏',
    disabledDesc: '不读取天气信息，氛围调整仅基于时间和 Coding 状态',
  },
  {
    key: 'projectContext' as const,
    label: '项目上下文',
    reads: '项目名称、Session 状态、文件活动、会话内容',
    why: '感知当前开发状态和情绪，自动切换 Mood 和音乐推荐',
    risk: 'medium' as const,
    enabledDesc: '读取项目元数据、git 信息、文件活动和会话内容，自动检测任务类型和情绪状态（开心/沮丧/疲惫/专注/焦虑等），影响音乐推荐',
    disabledDesc: '不读取项目信息和会话内容，任务类型和情绪始终为"未知"，音乐推荐仅基于时间和手动状态',
  },
  {
    key: 'commandExecution' as const,
    label: '命令执行',
    reads: 'Shell 命令执行权限',
    why: 'Coding Agent 执行构建、测试等任务',
    risk: 'high' as const,
    enabledDesc: 'Agent 可执行 Shell 命令（npm run build、git 等），高危命令会弹窗确认',
    disabledDesc: '禁止执行任何命令，Agent 仅提供建议和代码片段',
  },
  {
    key: 'fileOperations' as const,
    label: '文件操作',
    reads: '文件删除、创建、修改权限',
    why: 'Agent 需要操作会话目录下的文件（删除、重命名等）',
    risk: 'high' as const,
    enabledDesc: 'Agent 可在会话目录内执行文件删除、创建、修改等操作',
    disabledDesc: '禁止文件删除等破坏性操作，Agent 仅能读取和建议',
  },
];

// 二维码状态码
const QR_STATUS = {
  EXPIRED: 800,
  WAITING: 801,
  SCANNED: 802,
  SUCCESS: 803,
} as const;

export function PermissionDrawer() {
  const { permissionsOpen, closePermissions } = useSettingsStore();
  const [state, setState] = useState<PermissionState | null>(null);

  // 网易云登录状态
  const [musicAuth, setMusicAuth] = useState<{ connected: boolean; userId?: string; nickname?: string; avatar?: string; signature?: string; vipType?: number }>({ connected: false });

  // 二维码弹窗状态
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrImage, setQrImage] = useState<string>('');
  const [qrKey, setQrKey] = useState<string>('');
  const [qrStatus, setQrStatus] = useState<number>(QR_STATUS.WAITING);
  const [qrMessage, setQrMessage] = useState<string>('');
  const [qrLoading, setQrLoading] = useState<boolean>(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 退出确认弹窗状态
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  // 加载权限和登录状态
  useEffect(() => {
    if (permissionsOpen) {
      fetch(`${SIDECAR_BASE}/permissions`).then((r) => r.json()).then(setState).catch(() => {});
      getMusicAuthStatus().then(setMusicAuth).catch(() => {});
    }
  }, [permissionsOpen]);

  // 清理轮询定时器
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const toggle = async (key: keyof PermissionState) => {
    if (!state) return;
    const current = state[key];
    const next = current === 'enabled' ? 'disabled' : 'enabled';
    await fetch(`${SIDECAR_BASE}/permissions`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value: next }) });
    const r = await fetch(`${SIDECAR_BASE}/permissions`);
    setState(await r.json());
  };

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // 开始轮询二维码状态
  const startPolling = useCallback((key: string) => {
    stopPolling();

    pollTimerRef.current = setInterval(async () => {
      try {
        const result = await checkQrAuth(key);
        setQrStatus(result.code);
        setQrMessage(result.message);

        if (result.code === QR_STATUS.SUCCESS) {
          // 登录成功，停止轮询，刷新登录状态
          stopPolling();
          debugInfo(MODULE, '网易云登录成功');
          const status = await getMusicAuthStatus();
          setMusicAuth(status);
          // 延迟关闭弹窗，让用户看到成功提示
          setTimeout(() => {
            setQrModalOpen(false);
          }, 1500);
        } else if (result.code === QR_STATUS.EXPIRED) {
          // 二维码过期，停止轮询
          stopPolling();
          debugWarn(MODULE, '二维码已过期');
        }
      } catch (e) {
        debugWarn(MODULE, `轮询二维码状态失败: ${e}`);
      }
    }, 2000);
  }, [stopPolling]);

  // 打开二维码弹窗
  const handleOpenQrModal = async () => {
    setQrLoading(true);
    setQrModalOpen(true);
    setQrStatus(QR_STATUS.WAITING);
    setQrMessage('正在生成二维码...');

    try {
      const { key, qrimg } = await startQrAuth();
      setQrKey(key);
      setQrImage(qrimg);
      setQrMessage('请使用网易云音乐 App 扫码');
      startPolling(key);
    } catch (e) {
      debugWarn(MODULE, `生成二维码失败: ${e}`);
      setQrMessage('生成二维码失败，请重试');
    } finally {
      setQrLoading(false);
    }
  };

  // 刷新二维码
  const handleRefreshQr = async () => {
    stopPolling();
    setQrLoading(true);
    setQrStatus(QR_STATUS.WAITING);
    setQrMessage('正在刷新二维码...');

    try {
      const { key, qrimg } = await startQrAuth();
      setQrKey(key);
      setQrImage(qrimg);
      setQrMessage('请使用网易云音乐 App 扫码');
      startPolling(key);
    } catch (e) {
      debugWarn(MODULE, `刷新二维码失败: ${e}`);
      setQrMessage('刷新失败，请重试');
    } finally {
      setQrLoading(false);
    }
  };

  // 关闭二维码弹窗
  const handleCloseQrModal = () => {
    stopPolling();
    setQrModalOpen(false);
    setQrImage('');
    setQrKey('');
    setQrStatus(QR_STATUS.WAITING);
    setQrMessage('');
  };

  // 退出登录
  const handleLogout = async () => {
    try {
      await logoutMusic();
      setMusicAuth({ connected: false });
      setLogoutConfirmOpen(false);
      debugInfo(MODULE, '已退出网易云登录');
    } catch (e) {
      debugWarn(MODULE, `退出登录失败: ${e}`);
    }
  };

  // 打开退出确认弹窗
  const handleLogoutClick = () => {
    setLogoutConfirmOpen(true);
  };

  // 关闭退出确认弹窗
  const handleLogoutCancel = () => {
    setLogoutConfirmOpen(false);
  };

  if (!permissionsOpen) return null;
  const riskCls = { low: s.permCardRiskLow, medium: s.permCardRiskMedium, high: s.permCardRiskHigh };

  return (
    <>
      <div className={s.drawerOverlay} onClick={closePermissions} />
      <div className={s.drawer}>
        <div className={s.drawerHeader}>
          <span className={s.drawerTitle}>权限 & 隐私</span>
          <button className={s.drawerCloseBtn} onClick={closePermissions}>✕</button>
        </div>
        <div className={s.drawerBody}>
          {/* 网易云音乐授权卡片 */}
          <div className={s.neteaseCard}>
            <div className={s.neteaseCardHeader}>
              <div className={s.neteaseCardLeft}>
                <div className={s.neteaseLogo}>
                  <svg className={s.neteaseLogoIcon} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
                  </svg>
                </div>
                <div>
                  <div className={s.neteaseTitle}>网易云音乐</div>
                  <div className={s.neteaseSubtitle}>个性化推荐 & 更多资源</div>
                </div>
              </div>
              <span className={`${s.neteaseStatusBadge} ${musicAuth.connected ? s.neteaseStatusConnected : s.neteaseStatusDisconnected}`}>
                {musicAuth.connected ? '● 已连接' : '○ 未连接'}
              </span>
            </div>

            <div className={s.neteaseCardBody}>
              <div className={s.neteaseDesc}>
                连接后可获取个性化每日推荐、红心歌曲等专属内容，未连接时搜索和播放不受影响
              </div>
            </div>

            {musicAuth.connected ? (
              <div className={s.neteaseUserRow}>
                <div className={s.neteaseUserInfo}>
                  <div className={s.neteaseAvatar}>
                    {musicAuth.avatar ? <img src={musicAuth.avatar} alt="" /> : '♫'}
                  </div>
                  <div>
                    <div className={s.neteaseUserName}>
                      {musicAuth.nickname || 'Music Lover'}
                      {(musicAuth.vipType ?? 0) === 0 && (
                        <span className={s.vipBadge}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 4L10 16H12L18 4H15.5L12 12.5L8.5 4H4Z"/>
                          </svg>
                        </span>
                      )}
                      {(musicAuth.vipType ?? 0) >= 10 && (musicAuth.vipType ?? 0) < 100 && (
                        <span className={`${s.vipBadge} ${s.vipBadgeActive}`}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 4L10 16H12L18 4H15.5L12 12.5L8.5 4H4Z"/>
                          </svg>
                        </span>
                      )}
                      {(musicAuth.vipType ?? 0) >= 100 && (
                        <span className={`${s.vipBadge} ${s.vipBadgeActive} ${s.vipBadgeSvip}`}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 4L10 16H12L18 4H15.5L12 12.5L8.5 4H4Z"/>
                          </svg>
                          <span className={s.vipLevel}>S</span>
                        </span>
                      )}
                    </div>
                    <div className={s.neteaseUserLabel}>{musicAuth.signature || '这个人很懒，什么都没写'}</div>
                  </div>
                </div>
                <button className={s.neteaseLogoutBtn} onClick={handleLogoutClick}>退出</button>
              </div>
            ) : (
              <button className={s.neteaseConnectBtn} onClick={handleOpenQrModal}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
                扫码授权
              </button>
            )}
          </div>

          {/* 其他权限卡片 */}
          {perms.map((p) => {
            const val = state?.[p.key];
            const enabled = val === 'enabled';
            return (
              <div key={p.key} className={s.permCard}>
                <div className={s.permCardHeader}>
                  <span className={s.permCardTitle}>{p.label}</span>
                  <button className={`${s.drawerToggle} ${enabled ? s.drawerToggleActive : ''}`} onClick={() => toggle(p.key)}>
                    <div className={s.drawerToggleDot} />
                  </button>
                </div>
                <div className={s.permCardDesc}>{p.why}</div>
                <div className={s.permCardDetail}><span className={s.permCardDetailLabel}>数据范围：</span>{p.reads}</div>
                <div className={s.permCardDetail}>
                  <span className={s.permCardDetailLabel}>风险等级：</span>
                  <span className={`${s.permCardRisk} ${riskCls[p.risk]}`}>{p.risk === 'low' ? '低' : p.risk === 'medium' ? '中' : '高'}</span>
                </div>
                <div className={s.permCardStatusBox}>
                  <div className={s.permCardStatusLabel}>当前状态：{enabled ? <><IconCheck size={12} /> 已启用</> : <><IconDisabled size={12} /> 已禁用</>}</div>
                  <div className={s.permCardStatusDesc}>{enabled ? p.enabledDesc : p.disabledDesc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 二维码弹窗 */}
      {qrModalOpen && (
        <>
          <div className={s.drawerOverlay} onClick={handleCloseQrModal} />
          <div className={s.qrModal}>
            <div className={s.qrModalHeader}>
              <span className={s.qrModalTitle}>扫码登录网易云音乐</span>
              <button className={s.qrModalClose} onClick={handleCloseQrModal}>✕</button>
            </div>
            <div className={s.qrModalBody}>
              {qrLoading ? (
                <div className={s.qrLoading}>正在生成二维码...</div>
              ) : (
                <>
                  {qrImage && (
                    <div className={s.qrImageWrap}>
                      <img
                        src={qrImage}
                        alt="二维码"
                        className={`${s.qrImage} ${qrStatus === QR_STATUS.EXPIRED ? s.qrImageExpired : ''}`}
                      />
                    </div>
                  )}

                  <div className={`${s.qrStatus} ${
                    qrStatus === QR_STATUS.SUCCESS ? s.qrStatusSuccess :
                    qrStatus === QR_STATUS.EXPIRED ? s.qrStatusExpired :
                    qrStatus === QR_STATUS.SCANNED ? s.qrStatusScanned :
                    s.qrStatusWaiting
                  }`}>
                    {qrMessage}
                  </div>

                  {qrStatus === QR_STATUS.EXPIRED && (
                    <button className={s.qrRefreshBtn} onClick={handleRefreshQr}>
                      刷新二维码
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* 退出确认弹窗 */}
      {logoutConfirmOpen && (
        <>
          <div className={s.drawerOverlay} onClick={handleLogoutCancel} />
          <div className={s.confirmModal}>
            <div className={s.confirmModalHeader}>
              <span className={s.confirmModalTitle}>退出登录</span>
            </div>
            <div className={s.confirmModalBody}>
              <p className={s.confirmModalText}>确定要退出网易云音乐登录吗？</p>
              <p className={s.confirmModalHint}>退出后将无法获取个性化推荐</p>
            </div>
            <div className={s.confirmModalFooter}>
              <button className={s.confirmModalCancelBtn} onClick={handleLogoutCancel}>取消</button>
              <button className={s.confirmModalConfirmBtn} onClick={handleLogout}>确定退出</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
