import { useState, useEffect } from 'react';
import type { PermissionState } from '@music-coding/shared-types';
import { useSettingsStore } from '@/stores/settingsStore';
import { IconCheck, IconDisabled } from '@/components/common/Icons';
import s from '@/styles/layout.module.css';
import { SIDECAR_BASE } from '@/config';

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

export function PermissionDrawer() {
  const { permissionsOpen, closePermissions } = useSettingsStore();
  const [state, setState] = useState<PermissionState | null>(null);

  useEffect(() => { if (permissionsOpen) fetch(`${SIDECAR_BASE}/permissions`).then((r) => r.json()).then(setState).catch(() => {}); }, [permissionsOpen]);

  const toggle = async (key: keyof PermissionState) => {
    if (!state) return;
    const current = state[key];
    const next = current === 'enabled' ? 'disabled' : 'enabled';
    await fetch(`${SIDECAR_BASE}/permissions`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value: next }) });
    const r = await fetch(`${SIDECAR_BASE}/permissions`);
    setState(await r.json());
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
    </>
  );
}
