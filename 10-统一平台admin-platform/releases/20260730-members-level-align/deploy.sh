#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

RELEASE_ID="members-level-align-20260730"
APP="/www/wwwroot/dongfangwuquan/admin-platform"
SOURCE="src/app/(admin)/members/page.tsx"
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
    [[ -d "${APP}/.next-build" ]] && mv "${APP}/.next-build" "${APP}/.next-build.failed-${RELEASE_ID}"
    mv "$OLD_BUILD" "${APP}/.next-build"
  fi
  pm2 reload "${APP}/ecosystem.config.js" --only admin-platform --update-env
  printf 'FAILED_ROLLED_BACK %s\n' "$(date -Is)" >"${BACKUP}/status"
  exit "$code"
}
trap 'rollback $?' ERR

mkdir -p "${NEW_BUILD}/cache"
cp -a "${APP}/.next-build/cache/." "${NEW_BUILD}/cache/"
cd "$APP"
NEXT_DIST_DIR=".next-build.${RELEASE_ID}" node_modules/.bin/next build --webpack >"${BACKUP}/build.log" 2>&1
grep -R -q -m1 "累计消费" "${NEW_BUILD}/static"
if grep -R -q -m1 "平均课程数" "${NEW_BUILD}/static"; then
  false
fi

mv "${APP}/.next-build" "$OLD_BUILD"
mv "$NEW_BUILD" "${APP}/.next-build"
pm2 reload ecosystem.config.js --only admin-platform --update-env

for _ in $(seq 1 30); do
  code="$(curl -sS -o /dev/null --connect-timeout 3 --max-time 10 -w '%{http_code}' http://127.0.0.1:3003/members || true)"
  [[ "$code" == "200" ]] && break
  sleep 2
done
[[ "${code:-}" == "200" ]]
curl -fsS -o /dev/null https://admin.swod.com.cn/members
pm2 save
trap - ERR
printf 'SUCCESS %s\n' "$(date -Is)" >"${BACKUP}/status"
