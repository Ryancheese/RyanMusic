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
SRC_SWIFT="$ROOT/macos/AppMain.swift"

if ! command -v swiftc >/dev/null 2>&1; then
  echo "需要 swiftc（安装 Xcode Command Line Tools：xcode-select --install）" >&2
  exit 1
fi

if [[ ! -f "$SRC_SWIFT" ]]; then
  echo "找不到 $SRC_SWIFT" >&2
  exit 1
fi

echo "==> 清理旧包"
rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

echo "==> 编译原生窗口 App（WKWebView）"
swiftc -O \
  -framework Cocoa \
  -framework WebKit \
  -o "$MACOS_DIR/RyanMusic" \
  "$SRC_SWIFT"
chmod +x "$MACOS_DIR/RyanMusic"

echo "==> 写入 Info.plist"
cp "$ROOT/macos/Info.plist" "$CONTENTS/Info.plist"

echo "==> 写入 App 图标"
if [[ -f "$ROOT/macos/AppIcon.icns" ]]; then
  cp "$ROOT/macos/AppIcon.icns" "$RESOURCES_DIR/AppIcon.icns"
else
  echo "警告：未找到 macos/AppIcon.icns" >&2
fi

echo "==> 复制站点文件"
rsync -a \
  --exclude '.git/' \
  --exclude 'core/cache/' \
  --exclude '.DS_Store' \
  --exclude 'node_modules/' \
  "$SRC_MUSIC/" "$RESOURCES_DIR/maicong-music/"

mkdir -p "$RESOURCES_DIR/maicong-music/core/cache"

echo
echo "已生成：$APP_DIR"
echo "运行：open \"$APP_DIR\""
echo "安装到应用程序：cp -R \"$APP_DIR\" /Applications/"
