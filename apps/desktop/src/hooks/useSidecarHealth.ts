import { useEffect, useRef } from 'react';
import { useSidecarStore } from '@/stores/sidecarStore';

const HEALTH_INTERVAL = 5000;

export function useSidecarHealth() {
  const { port, setStatus, setVersion, setClaudeAvailable } = useSidecarStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const healthRes = await fetch(`http://localhost:${port}/health`);
        if (healthRes.ok) {
          const data = await healthRes.json();
          if (data.status === 'healthy') {
            setStatus('healthy');

            try {
              const verRes = await fetch(`http://localhost:${port}/version`);
              if (verRes.ok) setVersion((await verRes.json()).version);
            } catch {}

            try {
              const cfgRes = await fetch(`http://localhost:${port}/config`);
              if (cfgRes.ok) {
                const cfg = await cfgRes.json();
                setClaudeAvailable(cfg.claudeAvailable);
              }
            } catch {}
          } else {
            setStatus('degraded');
          }
        } else {
          setStatus('crashed');
        }
      } catch {
        setStatus('crashed');
      }
    };

    setStatus('starting');
    check();
    intervalRef.current = setInterval(check, HEALTH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [port, setStatus, setVersion, setClaudeAvailable]);
}
