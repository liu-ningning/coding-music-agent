/// <reference types="vite/client" />

// SVG 模块声明
declare module '*.svg' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_SIDECAR_HOST: string;
  readonly VITE_SIDECAR_PORT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
