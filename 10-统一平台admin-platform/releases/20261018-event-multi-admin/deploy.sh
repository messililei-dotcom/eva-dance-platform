#!/usr/bin/env bash
set -Eeuo pipefail
APP=/www/wwwroot/dongfangwuquan/admin-platform
STAGE=/www/wwwroot/dongfangwuquan/event-multi-stage-20261018
BACKUP=/www/backups/dongfangwuquan/event-multi-20261018
cd "$APP"
test -s "$STAGE/.next-build/BUILD_ID"
python3 - <<'CHECK'
import hashlib,json
from pathlib import Path
for f,h in json.loads(Path('/tmp/swod-multi-baseline.json').read_text()).items():
 assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h, 'Production changed: '+f
CHECK
cat > "$BACKUP/rollback.sh" <<'ROLLBACK'
#!/usr/bin/env bash
set -euo pipefail
APP=/www/wwwroot/dongfangwuquan/admin-platform
BACKUP=/www/backups/dongfangwuquan/event-multi-20261018
cd "$APP"
tar -xzf "$BACKUP/source-before.tar.gz" 'src/app/(admin)/events/page.tsx' src/app/api/event/_db.ts src/app/api/event/_access.ts src/app/api/event/_competition-owner.ts src/app/api/event/competitions/route.ts 'src/app/api/event/competitions/[id]/route.ts'
if [ -d "$BACKUP/old-build" ]; then
 mv .next-build "$BACKUP/failed-build-$(date +%s)"
 mv "$BACKUP/old-build" .next-build
fi
pm2 reload ecosystem.config.js --only admin-platform --update-env
printf 'ROLLED_BACK\n' > "$BACKUP/status"
ROLLBACK
chmod 700 "$BACKUP/rollback.sh"
trap 'bash "$BACKUP/rollback.sh"; exit 1' ERR
cp -an .next-build/static/. "$STAGE/.next-build/static/"
tar -xzf /tmp/swod-multi-payload.tar.gz -C "$APP"
mv .next-build "$BACKUP/old-build"
mv "$STAGE/.next-build" .next-build
pm2 reload ecosystem.config.js --only admin-platform --update-env
for attempt in $(seq 1 20); do
 code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3003/login || true)
 [ "$code" = 200 ] && break
 sleep 2
done
[ "$code" = 200 ]
trap - ERR
printf 'DEPLOYED\n' > "$BACKUP/status"
cat .next-build/BUILD_ID
