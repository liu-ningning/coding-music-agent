// ── Sidecar 配置 ──

// Sidecar 服务地址
export const SIDECAR_HOST = import.meta.env.VITE_SIDECAR_HOST || 'localhost';

// Sidecar 服务端口
export const SIDECAR_PORT = Number(import.meta.env.VITE_SIDECAR_PORT) || 4567;

// Sidecar 完整基础 URL
export const SIDECAR_BASE = `http://${SIDECAR_HOST}:${SIDECAR_PORT}`;

// ── 其他配置 ──

// 等待 Sidecar 启动的最大重试次数
export const SIDECAR_MAX_RETRIES = 30;

// 等待 Sidecar 启动的重试间隔（毫秒）
export const SIDECAR_RETRY_DELAY = 1000;
