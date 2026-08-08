#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

BASE="/www/wwwroot/dongfangwuquan/releases/wechat-identity-members-20260729-1045"
ADMIN="/www/wwwroot/dongfangwuquan/admin-platform"
BUILD="${ADMIN}/.next-build"
BACKUP="${BASE}/members-build-before-inline-hotfix.tgz"
STATUS="${BASE}/members-build-hotfix-status"
LOG="${BASE}/members-build-hotfix.log"
NEW_CHUNK="${BUILD}/static/chunks/app/(admin)/members/page-wechat-id-hotfix-20260729.js"

exec 9>"/var/lock/wechat-identity-members-build-hotfix.lock"
flock -n 9
exec >>"$LOG" 2>&1

rollback() {
  local code="$1"
  trap - ERR
  set +e
  rm -f -- "$NEW_CHUNK"
  tar -xzf "$BACKUP" -C "$ADMIN"
  cd "$ADMIN"
  pm2 reload ecosystem.config.js --only admin-platform --update-env || true
  printf 'FAILED_ROLLED_BACK %s\n' "$(date -Is)" >"$STATUS"
  exit "$code"
}

trap 'rollback $?' ERR
printf 'RUNNING %s\n' "$(date -Is)" >"$STATUS"

test -f "${BASE}/patch-members-build.mjs"
test -f "${BASE}/members-page.hotfix.tsx"
test -f "${BUILD}/static/chunks/app/(admin)/members/page-7b86e878f9775177.js"

tar -czf "$BACKUP" -C "$ADMIN" \
  ".next-build/static/chunks/app/(admin)/members/page-7b86e878f9775177.js" \
  ".next-build/server/app/(admin)/members/page.js" \
  ".next-build/server/app/members.rsc" \
  ".next-build/server/app/members.segments/_full.segment.rsc" \
  ".next-build/server/app/(admin)/members/page_client-reference-manifest.js" \
  ".next-build/server/app/(admin)/members/[id]/page_client-reference-manifest.js" \
  ".next-build/server/app/members.html" \
  "src/app/(admin)/members/page.tsx"

node "${BASE}/patch-members-build.mjs"
cp "${BASE}/members-page.hotfix.tsx" "${ADMIN}/src/app/(admin)/members/page.tsx"

test -f "$NEW_CHUNK"
test ! -e "${BUILD}/static/chunks/app/(admin)/members/page-7b86e878f9775177.js"
grep -q "page-wechat-id-hotfix-20260729.js" "${BUILD}/server/app/members.html"
grep -q "getMemberIdentity, memberSearchText, shortWxId" "${ADMIN}/src/app/(admin)/members/page.tsx"

cd "$ADMIN"
pm2 reload ecosystem.config.js --only admin-platform --update-env
for _ in $(seq 1 30); do
  code="$(curl -sS -o /dev/null --connect-timeout 3 --max-time 10 -w '%{http_code}' http://127.0.0.1:3003/members || true)"
  [[ "$code" == "200" ]] && break
  sleep 2
done
[[ "$code" == "200" ]]
pm2 save

trap - ERR
printf 'SUCCESS %s\n' "$(date -Is)" >"$STATUS"
