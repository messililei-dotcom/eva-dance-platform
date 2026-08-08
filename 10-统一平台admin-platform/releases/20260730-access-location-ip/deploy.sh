#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

RELEASE_ID="access-location-ip-20260730"
APP="/www/wwwroot/dongfangwuquan/admin-platform"
PAYLOAD="/tmp/${RELEASE_ID}.tar.gz"
STAGE="/tmp/${RELEASE_ID}"
BACKUP="/www/backups/dongfangwuquan/${RELEASE_ID}"
NEW_BUILD="${APP}/.next-build.${RELEASE_ID}"
OLD_BUILD="${BACKUP}/.next-build"
STATUS="${BACKUP}/status"

FILES=(
  "src/app/(admin)/access-records/page.tsx"
  "src/app/api/access-records/route.ts"
)

mkdir -p "$BACKUP" "$STAGE"
printf 'RUNNING %s\n' "$(date -Is)" >"$STATUS"

cleanup() {
  rm -rf -- "$STAGE" "$NEW_BUILD"
  rm -f -- "$PAYLOAD"
}

rollback() {
  local code="$1"
  trap - ERR
  set +e
  for file in "${FILES[@]}"; do
    cp -a "${BACKUP}/source/${file}" "${APP}/${file}"
  done
  if [[ -d "$OLD_BUILD" ]]; then
    rm -rf -- "${APP}/.next-build.failed-${RELEASE_ID}"
    if [[ -d "${APP}/.next-build" ]]; then
      mv "${APP}/.next-build" "${APP}/.next-build.failed-${RELEASE_ID}"
    fi
    mv "$OLD_BUILD" "${APP}/.next-build"
  fi
  cd "$APP"
  pm2 reload ecosystem.config.js --only admin-platform --update-env
  printf 'FAILED_ROLLED_BACK %s\n' "$(date -Is)" >"$STATUS"
  cleanup
  exit "$code"
}
trap 'rollback $?' ERR

tar -xzf "$PAYLOAD" -C "$STAGE"
for file in "${FILES[@]}"; do
  mkdir -p "${BACKUP}/source/$(dirname "$file")"
  cp -a "${APP}/${file}" "${BACKUP}/source/${file}"
  cp -a "${STAGE}/${file}" "${APP}/${file}"
done

sqlite3 "${APP}/admin.db" ".backup '${BACKUP}/admin.db'"
rm -rf -- "$NEW_BUILD"
mkdir -p "${NEW_BUILD}/cache"
cp -a "${APP}/.next-build/cache/." "${NEW_BUILD}/cache/"

cd "$APP"
NEXT_DIST_DIR=".next-build.${RELEASE_ID}" node_modules/.bin/next build --webpack >"${BACKUP}/build.log" 2>&1
grep -R -q -m1 "访问地址" "${NEW_BUILD}/static"
grep -R -q -m1 "IP地址" "${NEW_BUILD}/static"
if grep -R -q -m1 "IP地区" "${NEW_BUILD}/static"; then
  false
fi

mv "${APP}/.next-build" "$OLD_BUILD"
mv "$NEW_BUILD" "${APP}/.next-build"
pm2 reload ecosystem.config.js --only admin-platform --update-env

for _ in $(seq 1 30); do
  code="$(curl -sS -o /dev/null --connect-timeout 3 --max-time 10 -w '%{http_code}' http://127.0.0.1:3003/access-records || true)"
  [[ "$code" == "200" ]] && break
  sleep 2
done
[[ "${code:-}" == "200" ]]
curl -fsS -o /dev/null https://admin.swod.com.cn/access-records
pm2 save

trap - ERR
printf 'SUCCESS %s\n' "$(date -Is)" >"$STATUS"
cleanup
