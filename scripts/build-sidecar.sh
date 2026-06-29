#!/bin/bash
# 构建 sidecar：esbuild 打包为 bundle.js
# NeteaseCloudMusicApi 通过 npm 安装到 flat node_modules

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SIDECAR_DIR="$ROOT_DIR/apps/sidecar"
TAURI_DIR="$ROOT_DIR/apps/desktop/src-tauri"

echo "🔨 Building sidecar..."

# 1. 构建 TypeScript
cd "$SIDECAR_DIR"
pnpm build

# 2. 使用 esbuild 打包为单个文件（外部化 NeteaseCloudMusicApi）
echo "  Bundling with esbuild..."
pnpm build:bundle

# 3. 复制 bundle.js 到 Tauri 目录
cp "$SIDECAR_DIR/dist/bundle.js" "$TAURI_DIR/sidecar-bundle.js"

# 4. 用 npm 创建 flat node_modules（NeteaseCloudMusicApi 及其所有依赖）
echo "  Installing NeteaseCloudMusicApi dependencies with npm..."
DEPS_DIR="$TAURI_DIR/sidecar_deps"
rm -rf "$DEPS_DIR"
mkdir -p "$DEPS_DIR"
cd "$DEPS_DIR"
npm init -y > /dev/null 2>&1
npm install NeteaseCloudMusicApi@4.32.0 --save > /dev/null 2>&1

echo "✅ Sidecar bundle: $TAURI_DIR/sidecar-bundle.js"
echo "✅ Dependencies: $DEPS_DIR/node_modules"
