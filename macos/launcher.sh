#!/bin/bash
set -euo pipefail

APP_NAME="RyanMusic"
PID_FILE="/tmp/ryanmusic-php.pid"
PORT_FILE="/tmp/ryanmusic-php.port"
DEFAULT_PORT=18765

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT="$ROOT/Resources/maicong-music"

alert() {
  local message="$1"
  osascript -e "display alert \"$APP_NAME\" message \"$message\" as critical" >/dev/null 2>&1 || true
}

notify() {
  local message="$1"
  osascript -e "display notification \"$message\" with title \"$APP_NAME\"" >/dev/null 2>&1 || true
}

find_php() {
  local candidates=(
    /opt/homebrew/bin/php
    /usr/local/bin/php
  )
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

port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
  else
    return 1
  fi
}

pick_port() {
  local port="$DEFAULT_PORT"
  local i=0
  while port_in_use "$port" && [[ $i -lt 20 ]]; do
    port=$((DEFAULT_PORT + i + 1))
    i=$((i + 1))
  done
  echo "$port"
}

is_running() {
  if [[ ! -f "$PID_FILE" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    return 1
  fi
  kill -0 "$pid" 2>/dev/null
}

cleanup() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  fi
  rm -f "$PID_FILE" "$PORT_FILE"
}

open_app_url() {
  local port="$1"
  open "http://127.0.0.1:${port}/"
}

wait_ready() {
  local port="$1"
  local i=0
  while [[ $i -lt 40 ]]; do
    if curl -fsS "http://127.0.0.1:${port}/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.15
    i=$((i + 1))
  done
  return 1
}

main() {
  if [[ ! -d "$WEB_ROOT" ]]; then
    alert "找不到站点目录：$WEB_ROOT"
    exit 1
  fi

  local php_bin
  if ! php_bin="$(find_php)"; then
    alert "未找到 PHP。请先安装：brew install php"
    exit 1
  fi

  # 已在运行：直接打开现有地址（由原进程负责退出清理）
  if is_running && [[ -f "$PORT_FILE" ]]; then
    local existing_port
    existing_port="$(cat "$PORT_FILE")"
    open_app_url "$existing_port"
    notify "已在运行，已重新打开页面"
    exit 0
  fi

  trap cleanup EXIT INT TERM

  local port
  port="$(pick_port)"
  echo "$port" >"$PORT_FILE"

  "$php_bin" -S "127.0.0.1:${port}" -t "$WEB_ROOT" >/tmp/ryanmusic-php.log 2>&1 &
  local php_pid=$!
  echo "$php_pid" >"$PID_FILE"

  if ! wait_ready "$port"; then
    alert "PHP 服务启动失败，请查看 /tmp/ryanmusic-php.log"
    exit 1
  fi

  open_app_url "$port"
  notify "服务已启动：http://127.0.0.1:${port}"

  # 挂起，从 Dock 退出 App 时触发 cleanup
  while kill -0 "$php_pid" 2>/dev/null; do
    sleep 2
  done
}

main "$@"
