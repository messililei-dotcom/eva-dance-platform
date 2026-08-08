#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

APP="/www/wwwroot/dongfangwuquan/admin-platform"
BACKUP="/www/backups/dongfangwuquan/access-location-ip-20260730"
SOURCE="/tmp/enrich-access-ip-regions-20260730.mjs"
TARGET="${APP}/scripts/enrich-access-ip-regions.mjs"
CRON_MARKER="# SWOD access IP region enrichment"

mkdir -p "${APP}/scripts" "$BACKUP"
sqlite3 "${APP}/admin.db" ".backup '${BACKUP}/admin-before-region-enrichment.db'"
if [[ -f "$TARGET" ]]; then
  cp -a "$TARGET" "${BACKUP}/enrich-access-ip-regions.mjs"
fi
cp -a "$SOURCE" "$TARGET"
chmod 700 "$TARGET"

ADMIN_DB_PATH="${APP}/admin.db" node "$TARGET"

current_cron="$(crontab -l 2>/dev/null || true)"
filtered_cron="$(printf '%s\n' "$current_cron" | grep -vF "$CRON_MARKER" | grep -vF "$TARGET" || true)"
{
  printf '%s\n' "$filtered_cron"
  printf '%s\n' "$CRON_MARKER"
  printf '%s\n' "*/10 * * * * ADMIN_DB_PATH=${APP}/admin.db /usr/bin/node ${TARGET} >> ${BACKUP}/region-enricher.log 2>&1"
} | sed '/^[[:space:]]*$/d' | crontab -

printf 'REGION_ENRICHER_SUCCESS %s\n' "$(date -Is)" >>"${BACKUP}/status"
