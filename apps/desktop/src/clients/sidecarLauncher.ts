import { useSidecarStore } from '@/stores/sidecarStore';
import { SIDECAR_BASE, SIDECAR_PORT, SIDECAR_MAX_RETRIES, SIDECAR_RETRY_DELAY } from '@/config';
import { debugInfo, debugWarn } from '@/utils/debugLogger';

// 检测是否在 Tauri 环境
function isTauri(): boolean {
  return typeof window !== 'undefined' && (
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    (window as any).__TAURI_INTERNALS__ !== undefined
  );
}

async function checkSidecar(): Promise<boolean> {
  try {
    const res = await fetch(`${SIDECAR_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// 启动 sidecar
export async function launchSidecar(): Promise<void> {
  const { setStatus } = useSidecarStore.getState();
  setStatus('starting');

  // 检查是否已在运行
  if (await checkSidecar()) {
    setStatus('healthy');
    return;
  }

  // 在 Tauri 环境中，尝试自动启动 sidecar
  if (isTauri()) {
    try {
      debugInfo('sidecar', `Tauri 环境，启动 sidecar (端口 ${SIDECAR_PORT})...`);
      const { core } = await import('@tauri-apps/api');
      await core.invoke('start_sidecar', { port: SIDECAR_PORT });
    } catch (e) {
      debugWarn('sidecar', `Tauri 启动失败: ${e}`);
    }
  } else {
    debugInfo('sidecar', '请手动运行: pnpm dev:sidecar');
  }

  // 等待 sidecar 启动
  for (let i = 0; i < SIDECAR_MAX_RETRIES; i++) {
    await new Promise((r) => setTimeout(r, SIDECAR_RETRY_DELAY));
    if (await checkSidecar()) {
      setStatus('healthy');
      return;
    }
  }

  // 超时
  debugWarn('sidecar', '启动超时');
  setStatus('crashed');
}
