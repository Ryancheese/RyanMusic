#!/usr/bin/env bash
# 下载 Android arm64 静态 PHP，写入 jniLibs 供 APK 打包
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/app/src/main/jniLibs/arm64-v8a"
OUT_BIN="$OUT_DIR/libphp.so"
URL="${PHP_ANDROID_URL:-https://github.com/pmmp/PHP-Binaries/releases/download/php-build-516/PHP-8.3-Android-arm64-PM5.tar.gz}"

mkdir -p "$OUT_DIR"
if [[ -f "$OUT_BIN" && $(stat -f%z "$OUT_BIN" 2>/dev/null || stat -c%s "$OUT_BIN") -gt 1000000 ]]; then
  echo "已存在：$OUT_BIN"
  exit 0
fi

TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "==> 下载 PHP：$URL"
curl -fsSL -L -o "$TMP/php.tgz" "$URL"
tar -xzf "$TMP/php.tgz" -C "$TMP"
PHP_SRC="$(find "$TMP" -type f -path '*/bin/php' | head -1)"
if [[ -z "$PHP_SRC" ]]; then
  echo "压缩包内未找到 bin/php" >&2
  exit 1
fi
cp "$PHP_SRC" "$OUT_BIN"
chmod +x "$OUT_BIN"
echo "已写入：$OUT_BIN ($(du -h "$OUT_BIN" | awk '{print $1}'))"
