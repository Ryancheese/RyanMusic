#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="RyanMusic"
DIST_DIR="$ROOT/dist"
APP_DIR="$DIST_DIR/${APP_NAME}.app"
CONTENTS="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RESOURCES_DIR="$CONTENTS/Resources"
SRC_MUSIC="$ROOT/maicong-music"

echo "==> 清理旧包"
rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

echo "==> 写入 Info.plist"
cp "$ROOT/macos/Info.plist" "$CONTENTS/Info.plist"

echo "==> 写入启动脚本"
cp "$ROOT/macos/launcher.sh" "$MACOS_DIR/RyanMusic"
chmod +x "$MACOS_DIR/RyanMusic"

echo "==> 复制站点文件"
rsync -a \
  --exclude '.git/' \
  --exclude 'core/cache/' \
  --exclude '.DS_Store' \
  --exclude 'node_modules/' \
  "$SRC_MUSIC/" "$RESOURCES_DIR/maicong-music/"

# 确保缓存目录可写
mkdir -p "$RESOURCES_DIR/maicong-music/core/cache"

echo
echo "已生成：$APP_DIR"
echo "运行：open \"$APP_DIR\""
echo "安装到应用程序：cp -R \"$APP_DIR\" /Applications/"
