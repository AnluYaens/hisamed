#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-}"
DB_SERVICE="${DB_SERVICE:-db}"

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:-clinica_mvp}"
POSTGRES_USER="${POSTGRES_USER:-clinica}"
DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}@db:5432/${POSTGRES_DB}}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="${BACKUP_DIR}/${POSTGRES_DB}_${timestamp}.sql.gz"

mkdir -p "$BACKUP_DIR"

case "$DATABASE_URL" in
  *"@db:"*|*"@db/"*|*"@localhost:"*|*"@127.0.0.1:"*)
    if [ -n "$COMPOSE_PROJECT" ]; then
      docker compose -p "$COMPOSE_PROJECT" exec -T "$DB_SERVICE" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip -9 > "$backup_file"
    else
      docker compose exec -T "$DB_SERVICE" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip -9 > "$backup_file"
    fi
    ;;
  *)
    docker run --rm postgres:16-alpine \
      pg_dump "$DATABASE_URL" | gzip -9 > "$backup_file"
    ;;
esac

find "$BACKUP_DIR" -type f -name "${POSTGRES_DB}_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

echo "Backup created: $backup_file"
