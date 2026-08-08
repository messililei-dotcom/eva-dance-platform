#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

RELEASE_ID="wechat-identity-members-20260729-1045"
BASE="/www/wwwroot/dongfangwuquan/releases/${RELEASE_ID}"
ADMIN="/www/wwwroot/dongfangwuquan/admin-platform"
WEBSITE="/www/wwwroot/dongfangwuquan/website"
BACKUP="/www/backups/dongfangwuquan/${RELEASE_ID}"
STATUS="${BASE}/status"
LOG="${BASE}/deploy.log"

mkdir -p "$BACKUP"
exec 9>"/var/lock/${RELEASE_ID}.lock"
flock -n 9
exec >>"$LOG" 2>&1

ADMIN_SWAPPED=0
WEBSITE_SWAPPED=0
SOURCE_CHANGED=0

log() {
  printf '%s %s\n' "$(date '+%F %T %Z')" "$*"
}

wait_http() {
  local url="$1" expected="${2:-200}" code=""
  for _ in $(seq 1 30); do
    code="$(curl -sS -o /dev/null --connect-timeout 3 --max-time 10 -w '%{http_code}' "$url" || true)"
    [[ "$code" == "$expected" ]] && return 0
    sleep 2
  done
  log "health check failed url=${url} expected=${expected} actual=${code:-none}"
  return 1
}

restore_source() {
  local live="$1" manifest="$2" archive="$3" path
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    rm -f -- "${live}/${path}"
  done <"$manifest"
  tar -xzf "$archive" -C "$live"
}

rollback() {
  local code="$1"
  trap - ERR
  set +e
  log "deployment failed exit=${code}; rolling back"

  if [[ "$WEBSITE_SWAPPED" == "1" ]]; then
    rm -rf -- "${WEBSITE}/.next.failed-${RELEASE_ID}"
    mv "${WEBSITE}/.next" "${WEBSITE}/.next.failed-${RELEASE_ID}" 2>/dev/null || true
    mv "${BASE}/website-build-old" "${WEBSITE}/.next" 2>/dev/null || true
  fi
  rm -rf -- "${WEBSITE}/.next.new-${RELEASE_ID}"
  if [[ "$ADMIN_SWAPPED" == "1" ]]; then
    rm -rf -- "${ADMIN}/.next-build.failed-${RELEASE_ID}"
    mv "${ADMIN}/.next-build" "${ADMIN}/.next-build.failed-${RELEASE_ID}" 2>/dev/null || true
    mv "${BASE}/admin-build-old" "${ADMIN}/.next-build" 2>/dev/null || true
  fi
  if [[ "$SOURCE_CHANGED" == "1" ]]; then
    restore_source "$ADMIN" "${BASE}/admin-manifest.txt" "${BACKUP}/admin-code.tgz"
    restore_source "$WEBSITE" "${BASE}/website-manifest.txt" "${BACKUP}/website-code.tgz"
  fi
  [[ -f "${BACKUP}/admin-tsconfig.json" ]] && cp "${BACKUP}/admin-tsconfig.json" "${ADMIN}/tsconfig.json"

  cd "$ADMIN"
  pm2 reload ecosystem.config.js --only admin-platform --update-env || true
  cd "$WEBSITE"
  pm2 reload ecosystem.config.js --only dongfangwuquan-website --update-env || true
  pm2 save >/dev/null 2>&1 || true
  printf 'FAILED_ROLLED_BACK %s\n' "$(date -Is)" >"$STATUS"
  log "rollback finished; additive empty identity tables were retained"
  exit "$code"
}

trap 'rollback $?' ERR
printf 'RUNNING %s\n' "$(date -Is)" >"$STATUS"
log "starting guarded unified identity and members-page deployment"

test -d "$ADMIN"
test -d "$WEBSITE"
test -f "${BASE}/admin-delta.tgz"
test -f "${BASE}/website-delta.tgz"
test -f "${BASE}/admin-manifest.txt"
test -f "${BASE}/website-manifest.txt"
test -f "${ADMIN}/admin.db"
test "$(df --output=avail -B1 /www | tail -1)" -gt 2147483648
nginx -t
wait_http "http://127.0.0.1:3003/login" 200
wait_http "http://127.0.0.1:3001/" 200

cd "$ADMIN"
node -e 'const D=require("better-sqlite3");const db=new D("admin.db",{readonly:true});const q=db.pragma("quick_check");if(q[0].quick_check!=="ok")process.exit(1);for(const t of ["Member","Payment","CourseAuthorization","ConsumeRecord"])console.log(t,db.prepare("select count(*) n from "+t).get().n);db.close()' >"${BACKUP}/counts-before.txt"
sqlite3 "${ADMIN}/admin.db" ".backup '${BACKUP}/admin-before.db'"
test -s "${BACKUP}/admin-before.db"
test "$(sqlite3 "${BACKUP}/admin-before.db" 'PRAGMA quick_check;')" = "ok"
sha256sum "${BACKUP}/admin-before.db" >"${BACKUP}/admin-before.db.sha256"
cp "${ADMIN}/tsconfig.json" "${BACKUP}/admin-tsconfig.json"

while IFS= read -r path; do
  [[ -e "${ADMIN}/${path}" ]] && printf '%s\n' "$path"
done <"${BASE}/admin-manifest.txt" >"${BASE}/admin-existing.txt"
while IFS= read -r path; do
  [[ -e "${WEBSITE}/${path}" ]] && printf '%s\n' "$path"
done <"${BASE}/website-manifest.txt" >"${BASE}/website-existing.txt"

tar -czf "${BACKUP}/admin-code.tgz" -C "$ADMIN" -T "${BASE}/admin-existing.txt"
tar -czf "${BACKUP}/website-code.tgz" -C "$WEBSITE" -T "${BASE}/website-existing.txt"

tar -xzf "${BASE}/admin-delta.tgz" -C "$ADMIN"
tar -xzf "${BASE}/website-delta.tgz" -C "$WEBSITE"
SOURCE_CHANGED=1

sqlite3 "${ADMIN}/admin.db" <"${ADMIN}/migrations/20260729_wechat_identity.sql"
test "$(sqlite3 "${ADMIN}/admin.db" 'PRAGMA quick_check;')" = "ok"

rm -rf -- "${ADMIN}/.next-build.new-${RELEASE_ID}"
cd "$ADMIN"
if [[ -f "${ADMIN}/.next-build.failed-${RELEASE_ID}/BUILD_ID" ]] \
  && grep -R -q -m1 "平均课程数" "${ADMIN}/.next-build.failed-${RELEASE_ID}/static" \
  && [[ -f "${ADMIN}/.next-build.failed-${RELEASE_ID}/server/app/api/wechat/identity/sync/route.js" ]]; then
  mv "${ADMIN}/.next-build.failed-${RELEASE_ID}" "${ADMIN}/.next-build.new-${RELEASE_ID}"
  log "reusing previously verified admin candidate build"
else
  ALLOW_BUILD_TYPE_ERRORS=true NEXT_DIST_DIR=".next-build.new-${RELEASE_ID}" node_modules/.bin/next build --webpack
fi
cp "${BACKUP}/admin-tsconfig.json" "${ADMIN}/tsconfig.json"

rm -rf -- "${WEBSITE}/.next.new-${RELEASE_ID}"
cd "$WEBSITE"
NEXT_DIST_DIR=".next.new-${RELEASE_ID}" node_modules/.bin/next build --webpack

mv "${ADMIN}/.next-build" "${BASE}/admin-build-old"
mv "${ADMIN}/.next-build.new-${RELEASE_ID}" "${ADMIN}/.next-build"
ADMIN_SWAPPED=1
cd "$ADMIN"
pm2 reload ecosystem.config.js --only admin-platform --update-env
wait_http "http://127.0.0.1:3003/login" 200
wait_http "http://127.0.0.1:3003/api/wechat/identity/sync" 401

mv "${WEBSITE}/.next" "${BASE}/website-build-old"
mv "${WEBSITE}/.next.new-${RELEASE_ID}" "${WEBSITE}/.next"
WEBSITE_SWAPPED=1
cd "$WEBSITE"
pm2 reload ecosystem.config.js --only dongfangwuquan-website --update-env
wait_http "http://127.0.0.1:3001/" 200

wait_http "https://admin.swod.com.cn/login" 200
wait_http "https://admin.swod.com.cn/members" 200
wait_http "https://www.swod.com.cn/" 200

cd "$ADMIN"
node -e 'const D=require("better-sqlite3");const db=new D("admin.db",{readonly:true});const q=db.pragma("quick_check");if(q[0].quick_check!=="ok")process.exit(1);for(const t of ["WechatIdentity","WechatIdentityAudit"])db.prepare("select count(*) from "+t).get();for(const t of ["Member","Payment","CourseAuthorization","ConsumeRecord"])console.log(t,db.prepare("select count(*) n from "+t).get().n);db.close()' >"${BACKUP}/counts-after.txt"
paste "${BACKUP}/counts-before.txt" "${BACKUP}/counts-after.txt" |
  awk '$1 != $3 || $4 < $2 { exit 1 }'

pm2 save
trap - ERR
printf 'SUCCESS %s\n' "$(date -Is)" >"$STATUS"
log "deployment completed successfully"
