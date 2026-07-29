#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

RELEASE_ID="inbox-pure-20260729-0815"
BASE="/www/wwwroot/dongfangwuquan/releases/${RELEASE_ID}"
ADMIN="/www/wwwroot/dongfangwuquan/admin-platform"
WEBSITE="/www/wwwroot/dongfangwuquan/website"
BACKUP="/www/backups/dongfangwuquan/${RELEASE_ID}"
PROFILE="${WEBSITE}/src/app/dashboard/profile/page.tsx"
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
    code="$(curl -sS -o /dev/null --connect-timeout 3 --max-time 8 -w '%{http_code}' "$url" || true)"
    [[ "$code" == "$expected" ]] && return 0
    sleep 2
  done
  log "health check failed url=${url} expected=${expected} actual=${code:-none}"
  return 1
}

rollback() {
  local code="$1"
  trap - ERR
  set +e
  log "failure exit=${code}; rolling back to restored formal build"
  pm2 delete inbox-reminder-worker >/dev/null 2>&1 || true

  if [[ "$WEBSITE_SWAPPED" == "1" ]]; then
    mv "${WEBSITE}/.next" "${BASE}/website-next-failed" 2>/dev/null || true
    mv "${BACKUP}/website-next" "${WEBSITE}/.next" 2>/dev/null || true
  fi
  if [[ "$ADMIN_SWAPPED" == "1" ]]; then
    mv "${ADMIN}/.next-build" "${BASE}/admin-next-failed" 2>/dev/null || true
    mv "${BACKUP}/admin-next-build" "${ADMIN}/.next-build" 2>/dev/null || true
  fi
  if [[ "$SOURCE_CHANGED" == "1" ]]; then
    tar -xzf "${BACKUP}/admin-code.tgz" -C "$ADMIN"
    tar -xzf "${BACKUP}/website-code.tgz" -C "$WEBSITE"
  fi

  cd "$ADMIN"
  pm2 reload ecosystem.config.js --only admin-platform --update-env || true
  cd "$WEBSITE"
  pm2 reload ecosystem.config.js --only dongfangwuquan-website --update-env || true
  pm2 save >/dev/null 2>&1 || true
  wait_http "http://127.0.0.1:3003/login" 200 || true
  wait_http "http://127.0.0.1:3001/" 200 || true
  printf 'FAILED_ROLLED_BACK %s\n' "$(date -Is)" >"$STATUS"
  exit "$code"
}

trap 'rollback $?' ERR
printf 'RUNNING %s\n' "$(date -Is)" >"$STATUS"
log "starting pure inbox deployment"

test -d "${BASE}/admin/.next-build"
test -d "${BASE}/website/.next"
test -f "${BASE}/admin-delta.tgz"
test -f "${BASE}/website-delta-v2.tgz"
test -f "${BASE}/admin-manifest.txt"
test -f "${BASE}/website-manifest-v2.txt"
test "$(df --output=avail -B1 /www | tail -1)" -gt 2147483648
! grep -qE 'dashboard/profile/page\.tsx|member/profile/route\.ts' "${BASE}/website-manifest-v2.txt"
nginx -t
wait_http "http://127.0.0.1:3003/login" 200
wait_http "http://127.0.0.1:3001/" 200

sha256sum "$PROFILE" >"${BACKUP}/profile-before.sha256"
cd "$ADMIN"
node -e 'const D=require("better-sqlite3");const db=new D("admin.db",{readonly:true});const q=db.pragma("quick_check");if(q[0].quick_check!=="ok")process.exit(1);for(const t of ["Member","Payment","CourseAuthorization","ConsumeRecord"])console.log(t,db.prepare("select count(*) n from "+t).get().n);db.close()' >"${BACKUP}/counts-before.txt"
sqlite3 "${ADMIN}/admin.db" ".backup '${BACKUP}/admin-before.db'"
test "$(sqlite3 "${BACKUP}/admin-before.db" 'PRAGMA quick_check;')" = "ok"

tar -czf "${BACKUP}/admin-code.tgz" -C "$ADMIN" -T "${BASE}/admin-manifest.txt"
tar -czf "${BACKUP}/website-code.tgz" -C "$WEBSITE" -T "${BASE}/website-manifest-v2.txt"

cp -a "${BASE}/admin/.next-build" "${ADMIN}/.next-build.pure-new"
cp -a "${BASE}/website/.next" "${WEBSITE}/.next.pure-new"
tar -xzf "${BASE}/admin-delta.tgz" -C "$ADMIN"
tar -xzf "${BASE}/website-delta-v2.tgz" -C "$WEBSITE"
SOURCE_CHANGED=1

sha256sum -c "${BACKUP}/profile-before.sha256"

mv "${ADMIN}/.next-build" "${BACKUP}/admin-next-build"
mv "${ADMIN}/.next-build.pure-new" "${ADMIN}/.next-build"
ADMIN_SWAPPED=1
cd "$ADMIN"
pm2 reload ecosystem.config.js --only admin-platform --update-env
wait_http "http://127.0.0.1:3003/login" 200
pm2 start ecosystem.config.js --only inbox-reminder-worker --update-env
pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).find(x=>x.name==="inbox-reminder-worker");process.exit(p&&p.pm2_env.status==="online"?0:1)})'
wait_http "http://127.0.0.1:3003/api/mini/member/messages/unread-count" 401

mv "${WEBSITE}/.next" "${BACKUP}/website-next"
mv "${WEBSITE}/.next.pure-new" "${WEBSITE}/.next"
WEBSITE_SWAPPED=1
cd "$WEBSITE"
pm2 reload ecosystem.config.js --only dongfangwuquan-website --update-env
wait_http "http://127.0.0.1:3001/" 200
wait_http "http://127.0.0.1:3001/dashboard/profile" 200
wait_http "http://127.0.0.1:3001/dashboard/messages" 200

cd "$ADMIN"
node -e 'const D=require("better-sqlite3");const db=new D("admin.db",{readonly:true});const q=db.pragma("quick_check");if(q[0].quick_check!=="ok")process.exit(1);for(const t of ["InboxMessage","InboxRecipient","CourseContentRelease","InboxJobRun"])db.prepare("select count(*) from "+t).get();for(const t of ["Member","Payment","CourseAuthorization","ConsumeRecord"])console.log(t,db.prepare("select count(*) n from "+t).get().n);db.close()' >"${BACKUP}/counts-after.txt"
paste "${BACKUP}/counts-before.txt" "${BACKUP}/counts-after.txt" |
  awk '$1 != $3 || $4 < $2 { exit 1 }'

pm2 save
trap - ERR
printf 'SUCCESS %s\n' "$(date -Is)" >"$STATUS"
log "pure inbox deployment completed"
