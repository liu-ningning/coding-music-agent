import type { ToolCallRequest } from '@music-coding/shared-types';
import { IconCheck, IconError } from '@/components/common/Icons';
import s from '@/styles/layout.module.css';

export function ToolCallCard({ request }: { request: ToolCallRequest }) {
  const statusMap = {
    pending: { icon: <span className={s.runningDots}><span className={s.runningDot}/><span className={s.runningDot}/><span className={s.runningDot}/></span>, label: 'Pending', cls: '' },
    running: { icon: <span className={s.runningDots}><span className={s.runningDot}/><span className={s.runningDot}/><span className={s.runningDot}/></span>, label: 'Running...', cls: s.toolCardStatusRunning },
    done: { icon: <IconCheck size={12} />, label: 'Done', cls: s.toolCardStatusDone },
    error: { icon: <IconError size={12} />, label: 'Error', cls: s.toolCardStatusError },
  };
  const st = statusMap[request.status];
  return (
    <div className={s.toolCard}>
      <div className={s.toolCardHeader}>
        <span className={s.toolCardIcon}>{st.icon}</span>
        <span className={s.toolCardName}>{request.name}</span>
        <span className={`${s.toolCardStatus} ${st.cls}`}>{st.label}</span>
      </div>
      {request.result != null && (
        <pre className={s.toolCardResult}>{typeof request.result === 'string' ? request.result : JSON.stringify(request.result, null, 2)}</pre>
      )}
    </div>
  );
}
