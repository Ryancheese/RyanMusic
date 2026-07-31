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
MAKE_DMG=0
ARCH_NAME="$(uname -m)"
case "$ARCH_NAME" in
  arm64|aarch64) ARCH_LABEL="arm64" ;;
  x86_64) ARCH_LABEL="x64" ;;
  *) ARCH_LABEL="$ARCH_NAME" ;;
esac
DMG_PATH="$DIST_DIR/${APP_NAME}-mac-${ARCH_LABEL}.dmg"

for arg in "$@"; do
  case "$arg" in
    --bundle-php) BUNDLE_PHP=1 ;;
    --dmg) MAKE_DMG=1 ;;
    -h|--help)
      echo "Usage: $0 [--bundle-php] [--dmg]"
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

  echo "==> make DMG: ${out_dmg}"
  rm -rf "$stage" "$out_dmg"
  mkdir -p "$stage"
  ditto "$app" "$stage/${APP_NAME}.app"
  ln -sf /Applications "$stage/Applications"
  cat > "$stage/README.txt" <<'EOF'
RyanMusic macOS
===============

1. Drag RyanMusic to Applications.
2. First launch: right-click -> Open -> Open (Gatekeeper).
3. PHP is bundled; no brew install needed.
4. Closing the window quits the app.
EOF

  xattr -cr "$stage/${APP_NAME}.app" 2>/dev/null || true

  hdiutil create \
    -volname "$APP_NAME" \
    -srcfolder "$stage" \
    -ov \
    -format UDZO \
    "$out_dmg"

  rm -rf "$stage"
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

echo "==> compile WKWebView app [${ARCH_LABEL}]"
swiftc -O -framework Cocoa -framework WebKit -o "$MACOS_DIR/RyanMusic" "$SRC_SWIFT"
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
