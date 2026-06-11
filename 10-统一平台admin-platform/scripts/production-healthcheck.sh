#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/www/wwwroot/dongfangwuquan/admin-platform}"
APP_NAME="${APP_NAME:-admin-platform}"
APP_PORT="${APP_PORT:-3003}"
ADMIN_ORIGIN="${ADMIN_ORIGIN:-https://admin.dongfangwuquan.com}"

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
run curl -fsS --connect-timeout 5 --max-time 10 "http://127.0.0.1:${APP_PORT}/api/public-access" | head -c 500
printf '\n'

section "Nginx"
nginx -t
if command -v systemctl >/dev/null 2>&1; then
  systemctl status nginx --no-pager || true
fi

section "External checks"
run curl -fsS -I --connect-timeout 8 --max-time 15 "${ADMIN_ORIGIN}/login"
run curl -fsS --connect-timeout 8 --max-time 15 "${ADMIN_ORIGIN}/api/public-access" | head -c 500
printf '\n'

section "Done"
printf 'If external checks fail but local checks pass, inspect cloud security group, firewall, DNS, and Nginx certificate binding.\n'
