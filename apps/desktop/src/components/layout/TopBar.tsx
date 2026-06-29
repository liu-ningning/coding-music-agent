import { useSessionStore } from '@/stores/sessionStore';
import { TopStrip } from '@/components/music/TopStrip';
import s from '@/styles/layout.module.css';

export function TopBar() {
  const title = useSessionStore((st) => st.current?.title) || 'Untitled Session';
  return (
    <header className={s.topBar}>
      <div className={s.topBarTitle}>{title}</div>
      <TopStrip />
    </header>
  );
}
