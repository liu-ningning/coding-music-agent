import { useEffect } from 'react';
import type { ApprovalRequest } from '@music-coding/shared-types';
import { submitApproval } from '@/clients/agentSSE';
import { useAgentStore } from '@/stores/agentStore';
import { useSessionStore } from '@/stores/sessionStore';
import { IconWarning } from '@/components/common/Icons';
import s from '@/styles/layout.module.css';

export function ApprovalDialog({ approval }: { approval: ApprovalRequest }) {
  const sessionId = useSessionStore((st) => st.current?.id);
  const setApproval = useAgentStore((st) => st.setApproval);
  const riskCls = { low: s.approvalRiskLow, medium: s.approvalRiskMedium, high: s.approvalRiskHigh }[approval.riskLevel];

  const handle = async (d: 'approve_once' | 'deny') => {
    try {
      await submitApproval(approval.id, d);
      if (sessionId) setApproval(sessionId, null);
    } catch {
      // 审批提交失败，静默处理
    }
  };

  // 键盘快捷键：Enter 确认，Esc 拒绝
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handle('approve_once');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handle('deny');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [approval.id]);

  return (
    <div className={s.approvalOverlay} onClick={() => handle('deny')}>
      <div className={s.approvalDialog} onClick={(e) => e.stopPropagation()}>
        <div className={s.approvalTitle}><IconWarning size={16} /> 需要授权确认</div>
        <div className={s.approvalCommand}>
          <div className={s.approvalCommandLabel}>Agent 请求执行：</div>
          <pre className={s.approvalCommandText}>{approval.command || approval.description}</pre>
        </div>
        <div className={s.approvalMeta}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>风险等级：</span>
          <span className={`${s.approvalRisk} ${riskCls}`}>{approval.riskLevel}</span>
          {approval.affectedFiles && <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>· {approval.affectedFiles.length} 个文件</span>}
        </div>
        <div className={s.approvalActions}>
          <button className={s.approvalApproveBtn} onClick={() => handle('approve_once')}>批准执行</button>
          <button className={s.approvalDenyBtn} onClick={() => handle('deny')}>拒绝</button>
        </div>
        <div className={s.approvalHint}>Enter = 批准 · Esc = 拒绝</div>
      </div>
    </div>
  );
}
