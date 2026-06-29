#!/bin/bash

# 版本号更新脚本
# 用法: ./scripts/update-version.sh <version>
# 示例: ./scripts/update-version.sh 1.0.0

set -e

if [ -z "$1" ]; then
  echo "❌ 请指定版本号"
  echo "用法: ./scripts/update-version.sh <version>"
  echo "示例: ./scripts/update-version.sh 1.0.0"
  exit 1
fi

VERSION="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "📦 更新版本号到: $VERSION"

# 更新根目录 package.json
if [ -f "$ROOT_DIR/package.json" ]; then
  sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$ROOT_DIR/package.json"
  echo "✅ 更新 package.json"
fi

# 更新 desktop package.json
if [ -f "$ROOT_DIR/apps/desktop/package.json" ]; then
  sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$ROOT_DIR/apps/desktop/package.json"
  echo "✅ 更新 apps/desktop/package.json"
fi

# 更新 sidecar package.json
if [ -f "$ROOT_DIR/apps/sidecar/package.json" ]; then
  sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$ROOT_DIR/apps/sidecar/package.json"
  echo "✅ 更新 apps/sidecar/package.json"
fi

# 更新 Cargo.toml
if [ -f "$ROOT_DIR/apps/desktop/src-tauri/Cargo.toml" ]; then
  sed -i '' "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" "$ROOT_DIR/apps/desktop/src-tauri/Cargo.toml"
  echo "✅ 更新 apps/desktop/src-tauri/Cargo.toml"
fi

# 更新 tauri.conf.json
if [ -f "$ROOT_DIR/apps/desktop/src-tauri/tauri.conf.json" ]; then
  sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$ROOT_DIR/apps/desktop/src-tauri/tauri.conf.json"
  echo "✅ 更新 apps/desktop/src-tauri/tauri.conf.json"
fi

echo ""
echo "✨ 版本号已更新到 $VERSION"
echo ""
echo "更新的文件:"
echo "  - package.json"
echo "  - apps/desktop/package.json"
echo "  - apps/sidecar/package.json"
echo "  - apps/desktop/src-tauri/Cargo.toml"
echo "  - apps/desktop/src-tauri/tauri.conf.json"
