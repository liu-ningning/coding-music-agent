import type { AppError } from '@music-coding/shared-types';
import { IconError } from '@/components/common/Icons';
import s from '@/styles/layout.module.css';

export function ErrorCard({ error, onRetry, onDismiss }: { error: AppError; onRetry?: () => void; onDismiss?: () => void }) {
  return (
    <div className={s.errorCard}>
      <div className={s.errorCardTitle}>
        <IconError size={16} />
        <span className={s.errorCardCode}>{error.code}</span>
      </div>
      <p className={s.errorCardMsg}>{error.message}</p>
      <div className={s.errorCardActions}>
        {onRetry && <button className={s.errorCardBtn} onClick={onRetry}>Retry</button>}
        <button className={s.errorCardBtn} onClick={() => navigator.clipboard.writeText(`[${error.code}] ${error.message}`)}>Copy</button>
        {onDismiss && <button className={s.errorCardBtn} onClick={onDismiss}>Dismiss</button>}
      </div>
    </div>
  );
}
