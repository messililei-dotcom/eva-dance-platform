#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/www/wwwroot/dongfangwuquan/admin-platform}"
APP_NAME="${APP_NAME:-admin-platform}"
APP_PORT="${APP_PORT:-3003}"
ADMIN_ORIGIN="${ADMIN_ORIGIN:-https://admin.swod.com.cn}"
API_ORIGIN="${API_ORIGIN:-https://api.swod.com.cn}"
LEGACY_MINIAPI_ORIGIN="${LEGACY_MINIAPI_ORIGIN:-https://miniapi.swod.com.cn}"
PUBLIC_HEALTH_PATH="${PUBLIC_HEALTH_PATH:-/api/mini/public/home-stats}"
MAX_DISK_USED_PERCENT="${MAX_DISK_USED_PERCENT:-85}"

section() {
  printf '\n== %s ==\n' "$1"
}

run() {
  printf '+ %s\n' "$*"
  "$@"
}

section "Host"
hostname || true
date || true

section "Disk"
disk_used_percent="$(df -P "$APP_DIR" | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')"
printf 'Disk usage: %s%% (alert threshold: %s%%)\n' "$disk_used_percent" "$MAX_DISK_USED_PERCENT"
if (( disk_used_percent >= MAX_DISK_USED_PERCENT )); then
  printf 'Disk usage has reached the alert threshold.\n' >&2
  exit 1
fi

section "App directory"
run test -d "$APP_DIR"
run ls -la "$APP_DIR" | sed -n '1,40p'
run test -f "$APP_DIR/package.json"
run test -f "$APP_DIR/ecosystem.config.js"
run test -f "$APP_DIR/admin.db"

section "PM2"
pm2 list || true
pm2 describe "$APP_NAME" || true

section "Listening ports"
if command -v ss >/dev/null 2>&1; then
  ss -lntp | grep -E ":(${APP_PORT}|80|443)\\b" || true
else
  netstat -lntp 2>/dev/null | grep -E ":(${APP_PORT}|80|443)\\b" || true
fi

section "Local app checks"
run curl -fsS -I --connect-timeout 5 --max-time 10 "http://127.0.0.1:${APP_PORT}/login"
run curl -fsS --connect-timeout 5 --max-time 10 "http://127.0.0.1:${APP_PORT}${PUBLIC_HEALTH_PATH}" | head -c 500
printf '\n'

section "Nginx"
nginx -t
if command -v systemctl >/dev/null 2>&1; then
  systemctl status nginx --no-pager || true
fi

section "External checks"
run curl -fsS -I --connect-timeout 8 --max-time 15 "${ADMIN_ORIGIN}/login"
run curl -fsS --connect-timeout 8 --max-time 15 "${API_ORIGIN}${PUBLIC_HEALTH_PATH}" | head -c 500
printf '\n'
run curl -fsS --connect-timeout 8 --max-time 15 "${ADMIN_ORIGIN}${PUBLIC_HEALTH_PATH}" | head -c 500
printf '\n'
run curl -fsS --connect-timeout 8 --max-time 15 "${LEGACY_MINIAPI_ORIGIN}${PUBLIC_HEALTH_PATH}" | head -c 500
printf '\n'

section "Done"
printf 'If external checks fail but local checks pass, inspect cloud security group, firewall, DNS, and Nginx certificate binding.\n'
