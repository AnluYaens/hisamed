# Deploy en Produccion

La ruta recomendada para produccion es:

- App Next.js en Docker.
- Base de datos administrada en Supabase Postgres.
- Adjuntos clinicos en Cloudflare R2.
- Backups propios con `pg_dump`, ademas de los backups administrados de Supabase.

`docker-compose.yml` queda para desarrollo o pruebas full-stack con PostgreSQL local. En produccion usa `docker-compose.prod.yml`, que no levanta base de datos en el VPS.

## Requisitos

- VPS Linux con 2 GB RAM minimo.
- Docker Engine y Docker Compose plugin.
- Dominio apuntando al servidor.
- Caddy o Nginx para HTTPS.
- Proyecto Supabase creado para produccion.
- Bucket R2 para adjuntos.
- Backups externos al servidor.

## Supabase

1. Crea un proyecto Supabase de produccion.
2. Copia el connection string de Postgres.
3. Para la app, usa el **Session Pooler** connection string. Evita el Transaction Pooler para migraciones.
4. Activa SSL en la conexion usando `sslmode=require`.
5. Para datos clinicos reales bajo HIPAA, no uses un proyecto comun: necesitas BAA, HIPAA add-on, SSL Enforcement, Network Restrictions y PITR segun aplique.

Ejemplo de `DATABASE_URL`:

```bash
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```

## Variables de entorno

Copia `.env.example` a `.env` en el servidor y ajusta los valores:

```bash
# Supabase Postgres
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require

# Solo para nombres de backup/local tooling
POSTGRES_DB=postgres
POSTGRES_USER=postgres.PROJECT_REF

# Auth
JWT_SECRET=<openssl rand -base64 32>
JWT_REFRESH_SECRET=<openssl rand -base64 32>

# App
NEXT_PUBLIC_APP_URL=https://ehr.example.com
NODE_ENV=production

# Cloudflare R2
STORAGE_PROVIDER=r2
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET=clinica-attachments
R2_REGION=auto
```

En produccion usa `STORAGE_PROVIDER=r2`. El provider `local` escribe en el filesystem del contenedor y no es persistente para adjuntos clinicos.

Si tu password de Supabase contiene caracteres especiales, usa la version URL-encoded en `DATABASE_URL`.

## Migraciones

Antes de levantar la app por primera vez, ejecuta:

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
```

Repite este comando despues de desplegar cambios que incluyan nuevas migraciones.

## Levantar la app

Construir y levantar en produccion:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

La app queda expuesta en `http://SERVER_IP:3000`.

Si se usa una imagen publicada en registry, define `APP_IMAGE` en `.env`:

```bash
APP_IMAGE=ghcr.io/ORG/clinica-mvp:latest
```

Luego despliega manualmente:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## HTTPS con Caddy

Instala Caddy y crea un `Caddyfile` similar:

```caddyfile
ehr.example.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}
```

Recarga Caddy:

```bash
sudo systemctl reload caddy
```

Caddy solicita y renueva certificados automaticamente. Asegura que los puertos 80 y 443 esten abiertos en el firewall.

## Backups

Supabase tiene backups administrados, pero manten backups propios fuera de Supabase.

Crear un backup manual:

```bash
BACKUP_DIR=/var/backups/clinica-mvp ./scripts/backup-db.sh
```

Con `DATABASE_URL` remoto, el script usa un contenedor temporal `postgres:16-alpine` para correr `pg_dump`. Con la DB local de `docker-compose.yml`, usa `docker compose exec db`.

El archivo queda comprimido como `POSTGRES_DB_YYYYMMDDTHHMMSSZ.sql.gz`. El script borra backups de mas de 30 dias. Puedes cambiar la retencion:

```bash
RETENTION_DAYS=60 BACKUP_DIR=/var/backups/clinica-mvp ./scripts/backup-db.sh
```

Programa cron diario:

```cron
15 3 * * * cd /opt/clinica-mvp && BACKUP_DIR=/var/backups/clinica-mvp ./scripts/backup-db.sh >> /var/log/clinica-mvp-backup.log 2>&1
```

Sincroniza `/var/backups/clinica-mvp` a otro destino, por ejemplo otro servidor, S3/R2 privado o un backup service.

## Restaurar un backup

Para Supabase, planifica una ventana de mantenimiento y detén la app:

```bash
docker compose -f docker-compose.prod.yml stop app
```

Restaurar desde un backup propio:

```bash
gunzip -c /var/backups/clinica-mvp/postgres_20260424T030000Z.sql.gz | docker run --rm -i postgres:16-alpine psql "$DATABASE_URL"
```

Si necesitas limpiar el schema antes de restaurar, hazlo solo despues de confirmar que tienes un backup valido:

```bash
docker run --rm postgres:16-alpine psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

Luego levanta la app:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Para incidentes graves, evalua primero restaurar desde los backups/PITR de Supabase porque puede ser mas seguro operacionalmente.

## Desarrollo local

Para correr app y Postgres local:

```bash
docker compose up -d --build
docker compose --profile tools run --rm migrate
```

En local, la app usa el servicio `db` interno aunque `.env` tenga otra `DATABASE_URL`, porque `docker-compose.yml` la sobreescribe para apuntar a PostgreSQL local.

## CI

GitHub Actions corre en cada push a `main`:

- `pnpm lint`
- `pnpm type-check`
- `pnpm test -- --run`
- `pnpm build`

El deploy sigue siendo manual por SSH. El siguiente paso recomendado es publicar imagenes en GHCR desde CI y que el servidor haga `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`.
