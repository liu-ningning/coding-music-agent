import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ContextMenu } from '@/components/common/ContextMenu';
import { WorkspacePage } from '@/pages/WorkspacePage/WorkspacePage';

export function App() {
  return (
    <ErrorBoundary>
      <WorkspacePage />
      <ContextMenu />
    </ErrorBoundary>
  );
}
