#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

RELEASE_ID="wechat-login-enable-20260729"
BASE="/www/wwwroot/dongfangwuquan/releases/wechat-identity-members-20260729-1045"
WEBSITE="/www/wwwroot/dongfangwuquan/website"
ADMIN="/www/wwwroot/dongfangwuquan/admin-platform"
NEW_BUILD="${WEBSITE}/.next.${RELEASE_ID}"
OLD_BUILD="${BASE}/website-build-before-${RELEASE_ID}"
STATUS="${BASE}/wechat-login-enable-status"
LOG="${BASE}/wechat-login-enable.log"

exec 9>"/var/lock/${RELEASE_ID}.lock"
flock -n 9
exec >>"$LOG" 2>&1

SWAPPED=0

wait_http() {
  local url="$1" expected="${2:-200}" code=""
  for _ in $(seq 1 30); do
    code="$(curl -sS -o /dev/null --connect-timeout 3 --max-time 10 -w '%{http_code}' "$url" || true)"
    [[ "$code" == "$expected" ]] && return 0
    sleep 2
  done
  return 1
}

rollback() {
  local code="$1"
  trap - ERR
  set +e
  if [[ "$SWAPPED" == "1" ]]; then
    mv "${WEBSITE}/.next" "${WEBSITE}/.next.failed-${RELEASE_ID}" 2>/dev/null || true
    mv "$OLD_BUILD" "${WEBSITE}/.next" 2>/dev/null || true
  fi
  rm -rf -- "$NEW_BUILD"
  cd "$WEBSITE"
  pm2 reload ecosystem.config.js --only dongfangwuquan-website --update-env || true
  printf 'FAILED_ROLLED_BACK %s\n' "$(date -Is)" >"$STATUS"
  exit "$code"
}

trap 'rollback $?' ERR
printf 'RUNNING %s\n' "$(date -Is)" >"$STATUS"

grep -q '^NEXT_PUBLIC_WECHAT_QR_ENABLED=true$' "${WEBSITE}/.env.production"
grep -q '^WECHAT_QR_APP_ID=' "${WEBSITE}/.env.production"
grep -q '^WECHAT_QR_APP_SECRET=' "${WEBSITE}/.env.production"
rm -rf -- "$NEW_BUILD"

cd "$WEBSITE"
NEXT_DIST_DIR=".next.${RELEASE_ID}" node_modules/.bin/next build --webpack
grep -R -q -m1 "微信扫码登录" "${NEW_BUILD}/static"

rm -rf -- "$OLD_BUILD"
mv "${WEBSITE}/.next" "$OLD_BUILD"
mv "$NEW_BUILD" "${WEBSITE}/.next"
SWAPPED=1

pm2 reload ecosystem.config.js --only dongfangwuquan-website --update-env
cd "$ADMIN"
pm2 reload ecosystem.config.js --only admin-platform --update-env
wait_http "http://127.0.0.1:3001/" 200
wait_http "http://127.0.0.1:3003/login" 200
wait_http "https://www.swod.com.cn/" 200
wait_http "https://admin.swod.com.cn/login" 200

location="$(curl -sSI --max-time 15 'https://www.swod.com.cn/api/wechat/oauth/start?mode=qr&next=%2F' | awk 'BEGIN{IGNORECASE=1} /^location:/{sub(/\r$/, ""); print substr($0, 11); exit}')"
[[ "$location" == https://open.weixin.qq.com/connect/qrconnect* ]]
[[ "$location" == *"appid="* ]]

pm2 save
trap - ERR
printf 'SUCCESS %s\n' "$(date -Is)" >"$STATUS"
