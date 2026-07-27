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

ensure_php() {
  if find_php >/dev/null; then
    green "已检测到 PHP：$(find_php)"
    return 0
  fi

  yellow "未检测到 PHP，尝试通过 Homebrew 安装…"
  if ! command -v brew >/dev/null 2>&1; then
    red "未安装 Homebrew。请先安装：https://brew.sh"
    red "或手动执行：brew install php"
    exit 1
  fi

  brew install php
  if ! find_php >/dev/null; then
    red "PHP 安装后仍不可用，请检查 PATH 后重试。"
    exit 1
  fi
  green "PHP 安装完成：$(find_php)"
}

resolve_repo_root() {
  # 若在本仓库内执行，直接使用当前仓库
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f "$script_dir/build-app.sh" && -d "$script_dir/../maicong-music" ]]; then
    echo "$(cd "$script_dir/.." && pwd)"
    return 0
  fi
  return 1
}

fetch_repo() {
  mkdir -p "$WORK_DIR"
  if command -v git >/dev/null 2>&1; then
    echo "==> 克隆仓库"
    git clone --depth 1 --branch main "$REPO_URL" "$WORK_DIR/RyanMusic"
  else
    echo "==> 下载仓库 zip"
    local zip="$WORK_DIR/repo.zip"
    curl -fsSL -o "$zip" "https://github.com/Ryancheese/RyanMusic/archive/refs/heads/main.zip"
    if ! command -v unzip >/dev/null 2>&1; then
      red "需要 unzip 或 git 才能下载源码。"
      exit 1
    fi
    unzip -q "$zip" -d "$WORK_DIR"
    mv "$WORK_DIR"/RyanMusic-main "$WORK_DIR/RyanMusic"
  fi
  echo "$WORK_DIR/RyanMusic"
}

build_and_install() {
  local root="$1"
  chmod +x "$root/macos/build-app.sh" "$root/macos/launcher.sh"
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
  ensure_php

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
