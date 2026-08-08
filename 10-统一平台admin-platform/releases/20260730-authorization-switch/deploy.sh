#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

RELEASE_ID="authorization-switch-20260730"
APP="/www/wwwroot/dongfangwuquan/admin-platform"
SOURCE="src/app/(admin)/online-course/page.tsx"
PAYLOAD="/tmp/${RELEASE_ID}.tsx"
BACKUP="/www/backups/dongfangwuquan/${RELEASE_ID}"
NEW_BUILD="${APP}/.next-build.${RELEASE_ID}"
OLD_BUILD="${BACKUP}/.next-build"

mkdir -p "${BACKUP}/$(dirname "$SOURCE")"
cp -a "${APP}/${SOURCE}" "${BACKUP}/${SOURCE}"
sqlite3 "${APP}/admin.db" ".backup '${BACKUP}/admin.db'"
cp -a "$PAYLOAD" "${APP}/${SOURCE}"

rollback() {
  local code="$1"
  trap - ERR
  set +e
  cp -a "${BACKUP}/${SOURCE}" "${APP}/${SOURCE}"
  if [[ -d "$OLD_BUILD" ]]; then
    rm -rf -- "${APP}/.next-build.failed-${RELEASE_ID}"
    [[ -d "${APP}/.next-build" ]] && mv "${APP}/.next-build" "${APP}/.next-build.failed-${RELEASE_ID}"
    mv "$OLD_BUILD" "${APP}/.next-build"
  fi
  cd "$APP"
  pm2 reload ecosystem.config.js --only admin-platform --update-env
  printf 'FAILED_ROLLED_BACK %s\n' "$(date -Is)" >"${BACKUP}/status"
  exit "$code"
}
trap 'rollback $?' ERR

rm -rf -- "$NEW_BUILD"
mkdir -p "${NEW_BUILD}/cache"
cp -a "${APP}/.next-build/cache/." "${NEW_BUILD}/cache/"
cd "$APP"
NEXT_DIST_DIR=".next-build.${RELEASE_ID}" node_modules/.bin/next build --webpack >"${BACKUP}/build.log" 2>&1
grep -R -q -m1 "已授权" "${NEW_BUILD}/static"
grep -R -q -m1 "未授权" "${NEW_BUILD}/static"

mv "${APP}/.next-build" "$OLD_BUILD"
mv "$NEW_BUILD" "${APP}/.next-build"
pm2 reload ecosystem.config.js --only admin-platform --update-env

for _ in $(seq 1 30); do
  code="$(curl -sS -o /dev/null --connect-timeout 3 --max-time 10 -w '%{http_code}' http://127.0.0.1:3003/online-course/auth || true)"
  [[ "$code" == "200" || "$code" == "302" || "$code" == "307" ]] && break
  sleep 2
done
[[ "${code:-}" == "200" || "${code:-}" == "302" || "${code:-}" == "307" ]]
curl -fsS -o /dev/null https://admin.swod.com.cn/login
pm2 save

trap - ERR
printf 'SUCCESS %s\n' "$(date -Is)" >"${BACKUP}/status"
