#!/bin/bash
# RyanMusic macOS packager
# Usage:
#   ./macos/build-app.sh
#   ./macos/build-app.sh --bundle-php --dmg
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

BUNDLE_PHP=0
BUNDLE_NODE=1
MAKE_DMG=0
# 与官方 Node LTS 对齐；安装包内嵌后用户无需系统安装 Node
NODE_BUNDLE_VERSION="${NODE_BUNDLE_VERSION:-22.18.0}"
ARCH_NAME="$(uname -m)"
case "$ARCH_NAME" in
  arm64|aarch64) ARCH_LABEL="arm64"; NODE_DIST_ARCH="arm64" ;;
  x86_64) ARCH_LABEL="x64"; NODE_DIST_ARCH="x64" ;;
  *) ARCH_LABEL="$ARCH_NAME"; NODE_DIST_ARCH="$ARCH_NAME" ;;
esac
DMG_PATH="$DIST_DIR/${APP_NAME}-mac-${ARCH_LABEL}.dmg"

for arg in "$@"; do
  case "$arg" in
    --bundle-php) BUNDLE_PHP=1 ;;
    --bundle-node) BUNDLE_NODE=1 ;;
    --no-bundle-node) BUNDLE_NODE=0 ;;
    --dmg) MAKE_DMG=1 ;;
    -h|--help)
      echo "Usage: $0 [--bundle-php] [--bundle-node|--no-bundle-node] [--dmg]"
      exit 0
      ;;
  esac
done

is_system_lib() {
  case "$1" in
    /usr/lib/*|/System/*) return 0 ;;
    *) return 1 ;;
  esac
}

find_brew_lib() {
  local base="$1"
  local root found
  for root in /opt/homebrew/opt /usr/local/opt /opt/homebrew/Cellar /usr/local/Cellar /opt/homebrew/lib /usr/local/lib; do
    [[ -d "$root" ]] || continue
    found="$(find "$root" -name "$base" 2>/dev/null | grep -v anaconda | head -n 1 || true)"
    if [[ -n "$found" ]]; then
      echo "$found"
      return 0
    fi
  done
  return 1
}

# $1=target $2=libdir $3=mode(bin|lib) $4=optional source dir hint for @loader_path
bundle_deps_for() {
  local target="$1"
  local libdir="$2"
  local mode="$3"
  local src_hint="${4:-}"
  local dep base dest candidate src_dir

  while IFS= read -r dep; do
    [[ -z "$dep" ]] && continue
    is_system_lib "$dep" && continue

    candidate=""
    base=""
    if [[ "$dep" == @loader_path/* || "$dep" == @rpath/* ]]; then
      base="$(basename "$dep")"
      if [[ -n "$src_hint" && -f "$src_hint/$base" ]]; then
        candidate="$src_hint/$base"
      elif [[ -f "$libdir/$base" ]]; then
        candidate="$libdir/$base"
      else
        candidate="$(find_brew_lib "$base" || true)"
        [[ -n "$candidate" ]] || continue
      fi
    elif [[ "$dep" == @* ]]; then
      continue
    elif [[ -f "$dep" ]]; then
      candidate="$dep"
      base="$(basename "$dep")"
    else
      continue
    fi

    dest="$libdir/$base"
    if [[ ! -f "$dest" ]]; then
      src_dir="$(cd "$(dirname "$candidate")" && pwd)"
      cp -f "$candidate" "$dest"
      chmod u+w "$dest" 2>/dev/null || true
      install_name_tool -id "@loader_path/$base" "$dest" 2>/dev/null || true
      bundle_deps_for "$dest" "$libdir" "lib" "$src_dir"
    fi

    if [[ "$mode" == "bin" ]]; then
      install_name_tool -change "$dep" "@loader_path/../lib/$base" "$target" 2>/dev/null || true
    else
      install_name_tool -change "$dep" "@loader_path/$base" "$target" 2>/dev/null || true
    fi
  done < <(otool -L "$target" 2>/dev/null | tail -n +2 | awk '{print $1}')
}

resolve_missing_libs() {
  local libdir="$1"
  local changed=1
  local round=0
  local dep base dest found f src_dir

  while [[ "$changed" -eq 1 && "$round" -lt 12 ]]; do
    changed=0
    round=$((round + 1))
    for f in "$libdir"/*.dylib; do
      [[ -f "$f" ]] || continue
      while IFS= read -r dep; do
        [[ -z "$dep" ]] && continue
        if [[ "$dep" == @loader_path/* || "$dep" == @rpath/* ]]; then
          base="$(basename "$dep")"
        elif [[ "$dep" == /* ]]; then
          is_system_lib "$dep" && continue
          base="$(basename "$dep")"
        else
          continue
        fi
        dest="$libdir/$base"
        [[ -f "$dest" ]] && continue
        found=""
        if [[ "$dep" == /* && -f "$dep" ]]; then
          found="$dep"
        else
          found="$(find_brew_lib "$base" || true)"
        fi
        if [[ -n "$found" && -f "$found" ]]; then
          echo "    + $base"
          src_dir="$(cd "$(dirname "$found")" && pwd)"
          cp -f "$found" "$dest"
          chmod u+w "$dest" 2>/dev/null || true
          install_name_tool -id "@loader_path/$base" "$dest" 2>/dev/null || true
          bundle_deps_for "$dest" "$libdir" "lib" "$src_dir"
          changed=1
        fi
      done < <(otool -L "$f" 2>/dev/null | tail -n +2 | awk '{print $1}')
    done
  done
}

rewrite_absolute_refs() {
  local dest_root="$1"
  local libdir="$dest_root/lib"
  local bindir="$dest_root/bin"
  local f dep base

  for f in "$libdir"/*.dylib; do
    [[ -f "$f" ]] || continue
    while IFS= read -r dep; do
      [[ "$dep" == /* ]] || continue
      is_system_lib "$dep" && continue
      base="$(basename "$dep")"
      [[ -f "$libdir/$base" ]] || continue
      install_name_tool -change "$dep" "@loader_path/$base" "$f" 2>/dev/null || true
    done < <(otool -L "$f" 2>/dev/null | tail -n +2 | awk '{print $1}')
  done

  if [[ -f "$bindir/php" ]]; then
    while IFS= read -r dep; do
      [[ "$dep" == /* ]] || continue
      is_system_lib "$dep" && continue
      base="$(basename "$dep")"
      [[ -f "$libdir/$base" ]] || continue
      install_name_tool -change "$dep" "@loader_path/../lib/$base" "$bindir/php" 2>/dev/null || true
    done < <(otool -L "$bindir/php" 2>/dev/null | tail -n +2 | awk '{print $1}')
  fi
}

resign_php_bundle() {
  local dest_root="$1"
  local f
  for f in "$dest_root"/lib/*.dylib "$dest_root"/bin/php; do
    [[ -e "$f" ]] || continue
    codesign --force --sign - "$f" >/dev/null 2>&1 || true
  done
}

bundle_official_node() {
  local dest_root="$1"
  local ver="$NODE_BUNDLE_VERSION"
  local arch="$NODE_DIST_ARCH"
  local name="node-v${ver}-darwin-${arch}"
  local url="https://nodejs.org/dist/v${ver}/${name}.tar.gz"
  local cache_dir="$ROOT/dist/.cache"
  local tarball="$cache_dir/${name}.tar.gz"
  local extract_dir="$cache_dir/${name}"
  local node_bin

  mkdir -p "$cache_dir"
  if [[ ! -f "$tarball" ]]; then
    echo "==> download Node ${ver} (${arch})"
    curl -fL --retry 3 --retry-all-errors -o "$tarball" "$url"
  else
    echo "==> reuse cached Node ${ver} (${arch})"
  fi

  rm -rf "$extract_dir"
  mkdir -p "$extract_dir"
  tar -xzf "$tarball" -C "$cache_dir"
  node_bin="$extract_dir/bin/node"
  if [[ ! -x "$node_bin" ]]; then
    echo "error: Node binary missing in $tarball" >&2
    exit 1
  fi

  mkdir -p "$dest_root/bin"
  rm -rf "$dest_root/bin/node"
  cp -f "$node_bin" "$dest_root/bin/node"
  chmod +x "$dest_root/bin/node"
  codesign --force --sign - "$dest_root/bin/node" >/dev/null 2>&1 || true

  if ! "$dest_root/bin/node" -v >/dev/null 2>&1; then
    echo "warn: bundled node -v failed" >&2
  else
    echo "    bundled Node OK: $("$dest_root/bin/node" -v)"
  fi
}

bundle_homebrew_php() {
  local dest_root="$1"
  local php_bin bin_dir lib_dir ca_dest ver src_dir

  php_bin="$(command -v php || true)"
  if [[ -z "$php_bin" || ! -x "$php_bin" ]]; then
    echo "php not found. Install with: brew install php" >&2
    exit 1
  fi

  echo "==> bundle portable PHP: ${php_bin}"
  bin_dir="$dest_root/bin"
  lib_dir="$dest_root/lib"
  mkdir -p "$bin_dir" "$lib_dir"

  php_bin="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$php_bin")"
  src_dir="$(cd "$(dirname "$php_bin")" && pwd)"
  cp -f "$php_bin" "$bin_dir/php"
  chmod u+w "$bin_dir/php"
  chmod +x "$bin_dir/php"

  bundle_deps_for "$bin_dir/php" "$lib_dir" "bin" "$src_dir"
  resolve_missing_libs "$lib_dir"
  rewrite_absolute_refs "$dest_root"
  resign_php_bundle "$dest_root"

  ca_dest="$dest_root/cacert.pem"
  if [[ ! -f "$ca_dest" ]]; then
    echo "    download cacert.pem"
    curl -fsSL "https://curl.se/ca/cacert.pem" -o "$ca_dest" || true
  fi

  cat > "$dest_root/php.ini" <<'EOF'
; RyanMusic portable PHP (macOS)
date.timezone=Asia/Shanghai
memory_limit=256M
max_execution_time=60
display_errors=0
EOF

  if DYLD_FALLBACK_LIBRARY_PATH="$lib_dir" "$bin_dir/php" -c "$dest_root/php.ini" -v >/dev/null 2>&1; then
    ver="$(DYLD_FALLBACK_LIBRARY_PATH="$lib_dir" "$bin_dir/php" -c "$dest_root/php.ini" -r 'echo PHP_VERSION;')"
    echo "    bundled PHP OK: ${ver}"
  else
    echo "warn: bundled php -v failed" >&2
    DYLD_FALLBACK_LIBRARY_PATH="$lib_dir" "$bin_dir/php" -c "$dest_root/php.ini" -v 2>&1 | head -n 20 >&2 || true
    exit 1
  fi
}

make_dmg() {
  local app="$1"
  local out_dmg="$2"
  local stage="$DIST_DIR/dmg-stage-${ARCH_LABEL}"
  local rw_dmg="$DIST_DIR/dmg-rw-${ARCH_LABEL}.dmg"
  local bg_src="$ROOT/macos/dmg-background.png"
  local mount_dir=""
  local win_w=660
  local win_h=400

  echo "==> make DMG: ${out_dmg}"
  rm -rf "$stage" "$out_dmg" "$rw_dmg"
  mkdir -p "$stage/.background"
  ditto "$app" "$stage/${APP_NAME}.app"
  ln -sf /Applications "$stage/Applications"

  if [[ -f "$bg_src" ]]; then
    cp "$bg_src" "$stage/.background/background.png"
  else
    echo "warn: missing $bg_src — DMG will lack drag-install artwork" >&2
  fi

  xattr -cr "$stage/${APP_NAME}.app" 2>/dev/null || true

  # 可写镜像 → Finder 布局（拖到 Applications 指引）→ 再压成 UDZO
  local size_mb
  size_mb="$(du -sm "$stage" | awk '{print $1}')"
  size_mb=$((size_mb + 40))
  hdiutil create \
    -volname "$APP_NAME" \
    -srcfolder "$stage" \
    -ov \
    -fs HFS+ \
    -format UDRW \
    -size "${size_mb}m" \
    "$rw_dmg"

  # detach stale volume if any
  if [[ -d "/Volumes/${APP_NAME}" ]]; then
    hdiutil detach "/Volumes/${APP_NAME}" -force 2>/dev/null || true
    sleep 1
  fi

  mount_dir="$(hdiutil attach -readwrite -noverify -noautoopen "$rw_dmg" | awk '/\/Volumes\//{print $3; exit}')"
  if [[ -z "$mount_dir" || ! -d "$mount_dir" ]]; then
    echo "error: failed to mount RW DMG" >&2
    exit 1
  fi

  # 确保背景图在卷上（部分环境下 srcfolder 的点目录偶发丢失）
  mkdir -p "$mount_dir/.background"
  if [[ -f "$bg_src" ]]; then
    cp "$bg_src" "$mount_dir/.background/background.png"
  fi

  if [[ -f "$mount_dir/.background/background.png" ]]; then
    # Finder 图标坐标：左 App / 右 Applications，对齐背景箭头与虚线框
    osascript <<EOF
tell application "Finder"
  tell disk "$APP_NAME"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {200, 120, $((200 + win_w)), $((120 + win_h))}
    set theViewOptions to the icon view options of container window
    set arrangement of theViewOptions to not arranged
    set icon size of theViewOptions to 96
    set background picture of theViewOptions to file ".background:background.png"
    set position of item "${APP_NAME}.app" of container window to {150, 180}
    set position of item "Applications" of container window to {510, 180}
    update without registering applications
    delay 2
    close
  end tell
end tell
EOF
  else
    echo "warn: no background.png on volume; skipping Finder layout" >&2
  fi

  sync
  hdiutil detach "$mount_dir" || hdiutil detach "$mount_dir" -force
  sleep 1

  hdiutil convert "$rw_dmg" -format UDZO -imagekey zlib-level=9 -o "$out_dmg"
  rm -rf "$stage" "$rw_dmg"
  echo "DMG ready: ${out_dmg}"
}

if ! command -v swiftc >/dev/null 2>&1; then
  echo "Need swiftc. Install Xcode CLT: xcode-select --install" >&2
  exit 1
fi

if [[ ! -f "$SRC_SWIFT" ]]; then
  echo "Missing $SRC_SWIFT" >&2
  exit 1
fi

echo "==> clean"
rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR" "$DIST_DIR"

# 本机 Swift 默认 target 可能高于当前系统（如 macosx28.0），导致“无法与此版本 macOS 配合使用”
DEPLOY_TARGET="${MACOSX_DEPLOYMENT_TARGET:-12.0}"
case "$ARCH_NAME" in
  arm64|aarch64) SWIFT_TARGET="arm64-apple-macosx${DEPLOY_TARGET}" ;;
  x86_64) SWIFT_TARGET="x86_64-apple-macosx${DEPLOY_TARGET}" ;;
  *) SWIFT_TARGET="${ARCH_NAME}-apple-macosx${DEPLOY_TARGET}" ;;
esac

echo "==> compile WKWebView app [${ARCH_LABEL}] target=${SWIFT_TARGET}"
export MACOSX_DEPLOYMENT_TARGET="$DEPLOY_TARGET"
swiftc -O -target "$SWIFT_TARGET" \
  -framework Cocoa -framework WebKit -framework MediaPlayer \
  -o "$MACOS_DIR/RyanMusic" "$SRC_SWIFT"
chmod +x "$MACOS_DIR/RyanMusic"

echo "==> Info.plist"
cp "$ROOT/macos/Info.plist" "$CONTENTS/Info.plist"

echo "==> app icon"
if [[ -f "$ROOT/macos/AppIcon.icns" ]]; then
  cp "$ROOT/macos/AppIcon.icns" "$RESOURCES_DIR/AppIcon.icns"
else
  echo "warn: missing macos/AppIcon.icns" >&2
fi

echo "==> copy site files"
rsync -a \
  --exclude '.git/' \
  --exclude 'core/cache/' \
  --exclude '.DS_Store' \
  --exclude 'node_modules/' \
  "$SRC_MUSIC/" "$RESOURCES_DIR/maicong-music/"

mkdir -p "$RESOURCES_DIR/maicong-music/core/cache"

echo "==> build Node backend"
(
  cd "$ROOT/server"
  if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
  npm run build
)
cp -f "$ROOT/server/dist/server.mjs" "$RESOURCES_DIR/server.mjs"

if [[ "$BUNDLE_NODE" -eq 1 ]]; then
  bundle_official_node "$RESOURCES_DIR/node"
fi

if [[ "$BUNDLE_PHP" -eq 1 ]]; then
  bundle_homebrew_php "$RESOURCES_DIR/php"
fi

echo "==> ad-hoc codesign"
codesign --force --deep --sign - "$APP_DIR" 2>/dev/null || true
xattr -cr "$APP_DIR" 2>/dev/null || true

echo
echo "App: ${APP_DIR}"
echo "Run: open ${APP_DIR}"
echo "Install: cp -R ${APP_DIR} /Applications/"

if [[ "$MAKE_DMG" -eq 1 ]]; then
  make_dmg "$APP_DIR" "$DMG_PATH"
fi
