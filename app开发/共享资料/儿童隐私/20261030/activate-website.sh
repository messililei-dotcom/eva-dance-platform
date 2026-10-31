#!/bin/bash
set -euo pipefail
base=/www/wwwroot/dongfangwuquan/website
release=/www/wwwroot/dongfangwuquan/releases/swod-children-privacy-20261030
test -f "$release/build-ready"
test ! -e "$release/activated"
test ! -e "$release/before/.next"
test "$(sha256sum "$base/src/app/privacy/page.tsx" | cut -d' ' -f1)" = 82c2a0ce5ef80ae06b091c37375bfc25d8fb659f4d83189fce53b048735bf67a
test "$(sha256sum "$base/public/app/privacy.html" | cut -d' ' -f1)" = 66c9b9ccd60441dae05043baead7668e00123361463d93cfcef3236eb261be9c
for file in src/components/ChildrenPrivacyNotice.tsx src/content/children-privacy.json public/app/children-privacy.html; do
  test ! -e "$base/$file"
done
cp --parents "$base/src/app/privacy/page.tsx" "$base/public/app/privacy.html" "$release/before/"
rsync -a "$release/build/.next/" "$base/.next.children-privacy-20261030/"
rollback() {
  if test -d "$release/before/.next"; then
    if test -d "$base/.next"; then mv "$base/.next" "$release/failed-next"; fi
    mv "$release/before/.next" "$base/.next"
    cp "$release/before$base/src/app/privacy/page.tsx" "$base/src/app/privacy/page.tsx"
    cp "$release/before$base/public/app/privacy.html" "$base/public/app/privacy.html"
    for file in src/components/ChildrenPrivacyNotice.tsx src/content/children-privacy.json public/app/children-privacy.html; do
      if test -f "$base/$file"; then mv "$base/$file" "$release/before/failed-$(basename "$file")"; fi
    done
    pm2 restart dongfangwuquan-website > "$release/rollback.log" 2>&1
    touch "$release/rolled-back"
  fi
}
trap rollback ERR
mv "$base/.next" "$release/before/.next"
mv "$base/.next.children-privacy-20261030" "$base/.next"
while IFS= read -r file; do
  mkdir -p "$(dirname "$base/$file")"
  cp "$release/payload/$file" "$base/$file"
done < "$release/files.txt"
pm2 restart dongfangwuquan-website > "$release/restart.log" 2>&1
curl --retry 5 --retry-delay 2 --retry-all-errors --max-time 10 -fsS http://127.0.0.1:3001/privacy > "$release/privacy-live.html"
curl --retry 5 --retry-delay 2 --retry-all-errors --max-time 10 -fsS http://127.0.0.1:3001/app/children-privacy.html > "$release/children-live.html"
node - "$release" <<'NODE'
const fs=require('node:fs');
const release=process.argv[2];
const privacy=fs.readFileSync(release+'/privacy-live.html','utf8');
const children=fs.readFileSync(release+'/children-live.html','utf8');
if (!privacy.includes('儿童注册或报名须先由客服核实监护人授权') || !privacy.includes('2026年10月30日')) throw Error('Privacy content verification failed');
if (!children.includes('2026-10-30-children-v1') || !children.includes('李雷')) throw Error('Children policy verification failed');
NODE
touch "$release/activated"
trap - ERR
