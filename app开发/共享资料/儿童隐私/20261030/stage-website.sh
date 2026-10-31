#!/bin/bash
set -euo pipefail
base=/www/wwwroot/dongfangwuquan/website
release=/www/wwwroot/dongfangwuquan/releases/swod-children-privacy-20261030
stage="$release/build"
test ! -e "$stage"
mkdir -p "$stage" "$release/before"
rsync -a --exclude=node_modules --exclude='.next*' --exclude=.git --exclude=uploads --exclude=backups --exclude=deploy-backups --exclude=local-backups --exclude=releases --exclude='*.db*' "$base/" "$stage/"
ln -s "$base/node_modules" "$stage/node_modules"
ln -s /www/wwwroot/dongfangwuquan/admin-platform "$release/admin-platform"
while IFS= read -r file; do
  mkdir -p "$(dirname "$stage/$file")"
  cp "$release/payload/$file" "$stage/$file"
done < "$release/files.txt"
cd "$stage"
NEXT_TELEMETRY_DISABLED=1 node node_modules/next/dist/bin/next build --webpack > "$release/build.log" 2>&1
test -f .next/BUILD_ID
touch "$release/build-ready"
