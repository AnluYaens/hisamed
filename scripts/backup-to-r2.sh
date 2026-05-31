#!/usr/bin/env bash
set -euo pipefail

# ---- CONFIG (loaded from env) ----
: "${MIGRATE_DATABASE_URL:?MIGRATE_DATABASE_URL must be set}"
: "${R2_BUCKET:?R2_BUCKET must be set}"
: "${HEALTHCHECK_URL:?HEALTHCHECK_URL must be set}"
R2_PREFIX="${R2_PREFIX:-db-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
# --------------------------------

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="hisamed_${TIMESTAMP}.sql.gz"
TMPFILE="/tmp/${FILENAME}"

# Signal start (optional)
curl -fsS -m 10 --retry 3 "${HEALTHCHECK_URL}/start" || true

# Dump + compress
PGURL="${MIGRATE_DATABASE_URL//&uselibpqcompat=true/}"
PGURL="${PGURL//uselibpqcompat=true&/}"
PGURL="${PGURL//?uselibpqcompat=true/}"
PGURL="${PGURL//uselibpqcompat=true/}"
pg_dump "${PGURL}" --no-owner --no-acl | gzip > "${TMPFILE}"

# Sanity check: fail if the dump is suspiciously small (<10KB = something broke)
SIZE=$(stat -c%s "${TMPFILE}")
if [ "${SIZE}" -lt 10240 ]; then
  echo "Backup too small (${SIZE} bytes) — aborting"
  curl -fsS -m 10 "${HEALTHCHECK_URL}/fail" || true
  rm -f "${TMPFILE}"
  exit 1
fi

# Upload to R2
rclone copy "${TMPFILE}" "r2:${R2_BUCKET}/${R2_PREFIX}/" --s3-no-check-bucket

# Delete local temp
rm -f "${TMPFILE}"

# Prune R2 backups older than retention
rclone delete --min-age "${RETENTION_DAYS}d" "r2:${R2_BUCKET}/${R2_PREFIX}/" --s3-no-check-bucket

# Signal success
curl -fsS -m 10 --retry 3 "${HEALTHCHECK_URL}" || true

echo "Backup complete: ${FILENAME} (${SIZE} bytes)"