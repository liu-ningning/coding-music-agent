import { Component, type ReactNode, type ErrorInfo } from 'react';
import s from '@/styles/layout.module.css';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  componentDidCatch(): void { /* 错误已在 UI 中展示 */ }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className={s.errorBoundary}>
          <div className={s.errorBoundaryIcon}>😵</div>
          <h1 className={s.errorBoundaryTitle}>出现了一个错误</h1>
          <p className={s.errorBoundaryMsg}>{this.state.error?.message || '未知错误'}</p>
          <div className={s.errorBoundaryActions}>
            <button className={s.guidePrimaryBtn} style={{ width: 'auto', padding: '10px 24px' }} onClick={() => this.setState({ hasError: false, error: null })}>重试</button>
            <button className={s.guideSecondaryBtn} style={{ width: 'auto', padding: '10px 24px' }} onClick={() => navigator.clipboard.writeText(this.state.error?.stack || '')}>复制错误</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
