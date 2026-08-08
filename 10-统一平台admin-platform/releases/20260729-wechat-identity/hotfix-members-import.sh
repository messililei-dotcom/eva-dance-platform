#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

RELEASE_ID="wechat-identity-members-import-20260729"
BASE="/www/wwwroot/dongfangwuquan/releases/wechat-identity-members-20260729-1045"
ADMIN="/www/wwwroot/dongfangwuquan/admin-platform"
SOURCE="${ADMIN}/src/app/(admin)/members/page.tsx"
PATCH="${BASE}/members-page.hotfix.tsx"
NEW_BUILD="${ADMIN}/.next-build.hotfix-${RELEASE_ID}"
OLD_BUILD="${BASE}/admin-build-before-${RELEASE_ID}"
BACKUP_SOURCE="${BASE}/members-page.before-${RELEASE_ID}.tsx"
STATUS="${BASE}/hotfix-status"
LOG="${BASE}/hotfix.log"

exec 9>"/var/lock/${RELEASE_ID}.lock"
flock -n 9
exec >>"$LOG" 2>&1

SOURCE_CHANGED=0
BUILD_SWAPPED=0

wait_http() {
  local url="$1" code=""
  for _ in $(seq 1 30); do
    code="$(curl -sS -o /dev/null --connect-timeout 3 --max-time 10 -w '%{http_code}' "$url" || true)"
    [[ "$code" == "200" ]] && return 0
    sleep 2
  done
  return 1
}

rollback() {
  local code="$1"
  trap - ERR
  set +e
  if [[ "$BUILD_SWAPPED" == "1" ]]; then
    mv "${ADMIN}/.next-build" "${ADMIN}/.next-build.failed-${RELEASE_ID}" 2>/dev/null || true
    mv "$OLD_BUILD" "${ADMIN}/.next-build" 2>/dev/null || true
  fi
  [[ "$SOURCE_CHANGED" == "1" ]] && cp "$BACKUP_SOURCE" "$SOURCE"
  rm -rf -- "$NEW_BUILD"
  cd "$ADMIN"
  pm2 reload ecosystem.config.js --only admin-platform --update-env || true
  printf 'FAILED_ROLLED_BACK %s\n' "$(date -Is)" >"$STATUS"
  exit "$code"
}

trap 'rollback $?' ERR
printf 'RUNNING %s\n' "$(date -Is)" >"$STATUS"

test -f "$SOURCE"
test -f "$PATCH"
wait_http "http://127.0.0.1:3003/login"
cp "$SOURCE" "$BACKUP_SOURCE"
cp "$PATCH" "$SOURCE"
SOURCE_CHANGED=1
grep -q "getMemberIdentity, memberSearchText, shortWxId" "$SOURCE"

rm -rf -- "$NEW_BUILD"
cp -a --reflink=auto "${ADMIN}/.next-build" "$NEW_BUILD"
cd "$ADMIN"
ALLOW_BUILD_TYPE_ERRORS=true NEXT_DIST_DIR=".next-build.hotfix-${RELEASE_ID}" node_modules/.bin/next build --webpack

rm -rf -- "$OLD_BUILD"
mv "${ADMIN}/.next-build" "$OLD_BUILD"
mv "$NEW_BUILD" "${ADMIN}/.next-build"
BUILD_SWAPPED=1
pm2 reload ecosystem.config.js --only admin-platform --update-env
wait_http "http://127.0.0.1:3003/login"
wait_http "https://admin.swod.com.cn/members"

pm2 save
trap - ERR
printf 'SUCCESS %s\n' "$(date -Is)" >"$STATUS"
