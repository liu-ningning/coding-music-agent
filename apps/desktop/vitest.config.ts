import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    // 排除 Tauri 构建产物中的第三方测试文件
    exclude: [
      '**/node_modules/**',
      '**/src-tauri/**',
      '**/dist/**',
    ],
  },
});
