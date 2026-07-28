#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

RELEASE_ID="inbox-20260729-0500"
BASE="/www/wwwroot/dongfangwuquan/releases/${RELEASE_ID}"
LIVE_ADMIN="/www/wwwroot/dongfangwuquan/admin-platform"
LIVE_WEBSITE="/www/wwwroot/dongfangwuquan/website"
BACKUP_ROOT="/www/backups/dongfangwuquan/${RELEASE_ID}"
LOG_FILE="${BASE}/deploy.log"
STATUS_FILE="${BASE}/status"

mkdir -p "$BACKUP_ROOT"
exec 9>"/var/lock/${RELEASE_ID}.lock"
flock -n 9
exec >>"$LOG_FILE" 2>&1

ADMIN_CODE_CHANGED=0
WEBSITE_CODE_CHANGED=0
ADMIN_BUILD_SWAPPED=0
WEBSITE_BUILD_SWAPPED=0
DEPLOY_SUCCEEDED=0

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$*"
}

wait_http() {
  local url="$1"
  local expected="${2:-200}"
  local attempt code
  for attempt in $(seq 1 30); do
    code="$(curl -L -sS -o /dev/null --connect-timeout 3 --max-time 12 -w '%{http_code}' "$url" || true)"
    if [[ "$code" == "$expected" ]]; then
      return 0
    fi
    sleep 2
  done
  log "health check failed: ${url}, expected=${expected}, actual=${code:-none}"
  return 1
}

restore_manifest() {
  local live="$1"
  local manifest="$2"
  local archive="$3"
  local path
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    rm -f -- "${live}/${path}"
  done <"$manifest"
  tar -xzf "$archive" -C "$live"
}

rollback() {
  local exit_code="$1"
  trap - ERR
  set +e
  log "deployment failed with exit=${exit_code}; starting rollback"

  pm2 delete inbox-reminder-worker >/dev/null 2>&1 || true

  if [[ "$WEBSITE_BUILD_SWAPPED" == "1" ]]; then
    rm -rf -- "${LIVE_WEBSITE}/.next.failed-${RELEASE_ID}"
    mv "${LIVE_WEBSITE}/.next" "${LIVE_WEBSITE}/.next.failed-${RELEASE_ID}" 2>/dev/null || true
    mv "${BACKUP_ROOT}/website-next" "${LIVE_WEBSITE}/.next" 2>/dev/null || true
  fi
  if [[ "$WEBSITE_CODE_CHANGED" == "1" ]]; then
    restore_manifest "$LIVE_WEBSITE" "${BASE}/website-manifest.txt" "${BACKUP_ROOT}/website-code.tgz"
  fi

  if [[ "$ADMIN_BUILD_SWAPPED" == "1" ]]; then
    rm -rf -- "${LIVE_ADMIN}/.next-build.failed-${RELEASE_ID}"
    mv "${LIVE_ADMIN}/.next-build" "${LIVE_ADMIN}/.next-build.failed-${RELEASE_ID}" 2>/dev/null || true
    mv "${BACKUP_ROOT}/admin-next-build" "${LIVE_ADMIN}/.next-build" 2>/dev/null || true
  fi
  if [[ "$ADMIN_CODE_CHANGED" == "1" ]]; then
    restore_manifest "$LIVE_ADMIN" "${BASE}/admin-manifest.txt" "${BACKUP_ROOT}/admin-code.tgz"
  fi

  if [[ "$ADMIN_CODE_CHANGED" == "1" || "$ADMIN_BUILD_SWAPPED" == "1" ]]; then
    cd "$LIVE_ADMIN"
    pm2 reload ecosystem.config.js --only admin-platform --update-env || true
  fi
  if [[ "$WEBSITE_CODE_CHANGED" == "1" || "$WEBSITE_BUILD_SWAPPED" == "1" ]]; then
    cd "$LIVE_WEBSITE"
    pm2 reload ecosystem.config.js --only dongfangwuquan-website --update-env || true
  fi
  pm2 save >/dev/null 2>&1 || true

  wait_http "http://127.0.0.1:3003/login" 200 || true
  wait_http "http://127.0.0.1:3001/" 200 || true
  printf 'FAILED_ROLLED_BACK %s\n' "$(date -Is)" >"$STATUS_FILE"
  log "rollback finished; additive inbox tables were intentionally retained"
  exit "$exit_code"
}

trap 'rollback $?' ERR

log "starting guarded deployment ${RELEASE_ID}"
printf 'RUNNING %s\n' "$(date -Is)" >"$STATUS_FILE"

test -d "$LIVE_ADMIN"
test -d "$LIVE_WEBSITE"
test -d "${BASE}/admin/.next-build"
test -d "${BASE}/website/.next"
test -f "${BASE}/admin-delta.tgz"
test -f "${BASE}/website-delta.tgz"
test -f "${LIVE_ADMIN}/admin.db"
test "$(df --output=avail -B1 /www | tail -1)" -gt 2147483648
nginx -t
wait_http "http://127.0.0.1:3003/login" 200
wait_http "http://127.0.0.1:3001/" 200

cd "$LIVE_ADMIN"
node -e 'const D=require("better-sqlite3");const db=new D("admin.db",{readonly:true});const q=db.pragma("quick_check");if(q.length!==1||q[0].quick_check!=="ok")process.exit(1);for(const t of ["Member","Payment","CourseAuthorization","ConsumeRecord"])console.log(t,db.prepare("select count(*) n from "+t).get().n);db.close()' >"${BACKUP_ROOT}/counts-before.txt"

if [[ "${PRECHECK_ONLY:-0}" == "1" ]]; then
  trap - ERR
  printf 'PRECHECK_OK %s\n' "$(date -Is)" >"$STATUS_FILE"
  log "guarded deployment precheck completed successfully"
  exit 0
fi

sqlite3 "${LIVE_ADMIN}/admin.db" ".backup '${BACKUP_ROOT}/admin-before.db'"
test -s "${BACKUP_ROOT}/admin-before.db"
test "$(sqlite3 "${BACKUP_ROOT}/admin-before.db" 'PRAGMA quick_check;')" = "ok"
sha256sum "${BACKUP_ROOT}/admin-before.db" >"${BACKUP_ROOT}/admin-before.db.sha256"
log "production database snapshot completed and verified"

while IFS= read -r path; do
  [[ -e "${LIVE_ADMIN}/${path}" ]] && printf '%s\n' "$path"
done <"${BASE}/admin-manifest.txt" >"${BACKUP_ROOT}/admin-existing.txt"
tar -czf "${BACKUP_ROOT}/admin-code.tgz" -C "$LIVE_ADMIN" -T "${BACKUP_ROOT}/admin-existing.txt"

while IFS= read -r path; do
  [[ -e "${LIVE_WEBSITE}/${path}" ]] && printf '%s\n' "$path"
done <"${BASE}/website-manifest.txt" >"${BACKUP_ROOT}/website-existing.txt"
tar -czf "${BACKUP_ROOT}/website-code.tgz" -C "$LIVE_WEBSITE" -T "${BACKUP_ROOT}/website-existing.txt"

rm -rf -- "${LIVE_ADMIN}/.next-build.new-${RELEASE_ID}" "${LIVE_WEBSITE}/.next.new-${RELEASE_ID}"
cp -a "${BASE}/admin/.next-build" "${LIVE_ADMIN}/.next-build.new-${RELEASE_ID}"
cp -a "${BASE}/website/.next" "${LIVE_WEBSITE}/.next.new-${RELEASE_ID}"

tar -xzf "${BASE}/admin-delta.tgz" -C "$LIVE_ADMIN"
ADMIN_CODE_CHANGED=1
sqlite3 "${LIVE_ADMIN}/admin.db" <"${LIVE_ADMIN}/migrations/20260728_inbox_messages.sql"
test "$(sqlite3 "${LIVE_ADMIN}/admin.db" 'PRAGMA quick_check;')" = "ok"

mv "${LIVE_ADMIN}/.next-build" "${BACKUP_ROOT}/admin-next-build"
mv "${LIVE_ADMIN}/.next-build.new-${RELEASE_ID}" "${LIVE_ADMIN}/.next-build"
ADMIN_BUILD_SWAPPED=1

cd "$LIVE_ADMIN"
pm2 reload ecosystem.config.js --only admin-platform --update-env
wait_http "http://127.0.0.1:3003/login" 200
pm2 start ecosystem.config.js --only inbox-reminder-worker --update-env
sleep 3
pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).find(x=>x.name==="inbox-reminder-worker");process.exit(p&&p.pm2_env.status==="online"?0:1)})'
wait_http "http://127.0.0.1:3003/api/mini/member/messages/unread-count" 401

tar -xzf "${BASE}/website-delta.tgz" -C "$LIVE_WEBSITE"
WEBSITE_CODE_CHANGED=1
mv "${LIVE_WEBSITE}/.next" "${BACKUP_ROOT}/website-next"
mv "${LIVE_WEBSITE}/.next.new-${RELEASE_ID}" "${LIVE_WEBSITE}/.next"
WEBSITE_BUILD_SWAPPED=1

cd "$LIVE_WEBSITE"
pm2 reload ecosystem.config.js --only dongfangwuquan-website --update-env
wait_http "http://127.0.0.1:3001/" 200

wait_http "https://admin.dongfangwuquan.com/login" 200
wait_http "https://www.dongfangwuquan.com/" 200
wait_http "https://www.dongfangwuquan.com/dashboard/messages" 200

cd "$LIVE_ADMIN"
node -e 'const D=require("better-sqlite3");const db=new D("admin.db",{readonly:true});const q=db.pragma("quick_check");if(q.length!==1||q[0].quick_check!=="ok")process.exit(1);for(const t of ["InboxMessage","InboxRecipient","CourseContentRelease","InboxJobRun"])db.prepare("select count(*) from "+t).get();for(const t of ["Member","Payment","CourseAuthorization","ConsumeRecord"])console.log(t,db.prepare("select count(*) n from "+t).get().n);db.close()' >"${BACKUP_ROOT}/counts-after.txt"
paste "${BACKUP_ROOT}/counts-before.txt" "${BACKUP_ROOT}/counts-after.txt" |
  awk '$1 != $3 || $4 < $2 { exit 1 }'

pm2 save
DEPLOY_SUCCEEDED=1
trap - ERR
printf 'SUCCESS %s\n' "$(date -Is)" >"$STATUS_FILE"
log "deployment completed successfully"
