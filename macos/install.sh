#!/bin/bash
# RyanMusic macOS 一键安装脚本
# 用法：
#   curl -fsSL https://raw.githubusercontent.com/Ryancheese/RyanMusic/main/macos/install.sh | bash
# 或在仓库内：
#   ./macos/install.sh

set -euo pipefail

REPO_URL="https://github.com/Ryancheese/RyanMusic.git"
REPO_RAW="https://raw.githubusercontent.com/Ryancheese/RyanMusic/main"
APP_NAME="RyanMusic"
INSTALL_APP="/Applications/${APP_NAME}.app"
WORK_DIR="${TMPDIR:-/tmp}/ryanmusic-install-$$"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

cleanup() {
  rm -rf "$WORK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

require_macos() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    red "本安装脚本仅支持 macOS。"
    exit 1
  fi
}

find_php() {
  local candidates=(/opt/homebrew/bin/php /usr/local/bin/php)
  local c
  for c in "${candidates[@]}"; do
    if [[ -x "$c" ]]; then
      echo "$c"
      return 0
    fi
  done
  if command -v php >/dev/null 2>&1; then
    command -v php
    return 0
  fi
  return 1
}

find_node() {
  local candidates=(/opt/homebrew/bin/node /usr/local/bin/node)
  local c
  for c in "${candidates[@]}"; do
    if [[ -x "$c" ]]; then
      echo "$c"
      return 0
    fi
  done
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi
  return 1
}

ensure_node() {
  if find_node >/dev/null; then
    green "已检测到 Node：$(find_node) ($("$(find_node)" -v))"
    return 0
  fi

  yellow "未检测到 Node.js，尝试通过 Homebrew 安装…"
  if ! command -v brew >/dev/null 2>&1; then
    red "未安装 Homebrew。请先安装：https://brew.sh"
    red "或手动执行：brew install node"
    exit 1
  fi

  brew install node
  hash -r 2>/dev/null || true
  if ! find_node >/dev/null; then
    red "Node 安装后仍不可用，请检查 PATH 后重试。"
    exit 1
  fi
  green "Node 安装完成：$(find_node)"
}

note_php_fallback() {
  if find_php >/dev/null; then
    green "已检测到 PHP（Node 不可用时的回退）：$(find_php)"
  else
    yellow "未检测到 PHP。桌面端将使用 Node 后端。"
  fi
}

ensure_swiftc() {
  if command -v swiftc >/dev/null 2>&1; then
    return 0
  fi
  red "未找到 swiftc。请先安装 Xcode Command Line Tools："
  red "  xcode-select --install"
  exit 1
}

resolve_repo_root() {
  # curl | bash 时 BASH_SOURCE 可能未设置，不能当本地仓库用
  local src="${BASH_SOURCE[0]:-}"
  if [[ -z "$src" || "$src" == "bash" || "$src" == "-bash" || "$src" == "/dev/fd/"* ]]; then
    return 1
  fi
  local script_dir
  script_dir="$(cd "$(dirname "$src")" && pwd)"
  if [[ -f "$script_dir/build-app.sh" && -d "$script_dir/../maicong-music" ]]; then
    echo "$(cd "$script_dir/.." && pwd)"
    return 0
  fi
  return 1
}

fetch_repo() {
  mkdir -p "$WORK_DIR"
  if command -v git >/dev/null 2>&1; then
    echo "==> 克隆仓库" >&2
    git clone --depth 1 --branch main "$REPO_URL" "$WORK_DIR/RyanMusic" >&2
  else
    echo "==> 下载仓库 zip" >&2
    local zip="$WORK_DIR/repo.zip"
    curl -fsSL -o "$zip" "https://github.com/Ryancheese/RyanMusic/archive/refs/heads/main.zip"
    if ! command -v unzip >/dev/null 2>&1; then
      red "需要 unzip 或 git 才能下载源码。"
      exit 1
    fi
    unzip -q "$zip" -d "$WORK_DIR"
    mv "$WORK_DIR"/RyanMusic-main "$WORK_DIR/RyanMusic"
  fi
  # 只把路径打到 stdout，供 root="$(fetch_repo)" 捕获
  printf '%s\n' "$WORK_DIR/RyanMusic"
}

build_and_install() {
  local root="$1"
  chmod +x "$root/macos/build-app.sh" "$root/macos/install.sh"
  echo "==> 打包 App"
  "$root/macos/build-app.sh"

  local built="$root/dist/${APP_NAME}.app"
  if [[ ! -d "$built" ]]; then
    red "打包失败：未找到 $built"
    exit 1
  fi

  echo "==> 安装到 $INSTALL_APP"
  rm -rf "$INSTALL_APP"
  cp -R "$built" "$INSTALL_APP"

  # 去掉隔离标记，减少首次打开被拦
  xattr -dr com.apple.quarantine "$INSTALL_APP" 2>/dev/null || true

  green "安装完成：$INSTALL_APP"
}

main() {
  require_macos
  ensure_node
  note_php_fallback
  ensure_swiftc

  local root
  if root="$(resolve_repo_root)"; then
    yellow "使用本地仓库：$root"
  else
    root="$(fetch_repo)"
  fi

  build_and_install "$root"

  echo
  green "双击打开：open \"$INSTALL_APP\""
  yellow "若系统拦截：右键 App → 打开，或到「系统设置 → 隐私与安全性」允许。"
  echo

  if [[ -t 0 ]]; then
    read -r -p "现在打开 RyanMusic？[Y/n] " ans || true
    ans="${ans:-Y}"
    if [[ "$ans" =~ ^[Yy]$ ]]; then
      open "$INSTALL_APP"
    fi
  else
    # curl | bash 等非交互场景：默认打开
    open "$INSTALL_APP" || true
  fi
}

main "$@"
