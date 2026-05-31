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
3. Hay dos conexiones distintas, con puertos distintos:
   - **App en runtime → Transaction Pooler (puerto 6543)**. Es la conexion
     que usa la app (`DATABASE_URL`).
   - **Migraciones → Session Pooler (puerto 5432)**. drizzle-kit necesita
     una sesion estable para DDL; va en `MIGRATE_DATABASE_URL`.
4. Activa SSL. En produccion la app verifica el certificado:
   `sslmode=verify-full&sslrootcert=/app/certs/supabase-ca.crt` (el CA de
   Supabase se copia dentro del contenedor). El tooling de migraciones
   ademas agrega `uselibpqcompat=true` para restaurar semantica libpq.
5. Para datos clinicos reales bajo HIPAA, no uses un proyecto comun: necesitas BAA, HIPAA add-on, SSL Enforcement, Network Restrictions y PITR segun aplique.

Ejemplo de `DATABASE_URL` (app, transaction pooler 6543):

```bash
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=verify-full&sslrootcert=/app/certs/supabase-ca.crt
```

Ejemplo de `MIGRATE_DATABASE_URL` (migraciones, session pooler 5432):

```bash
MIGRATE_DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```

## Variables de entorno

Copia `.env.example` a `.env` en el servidor y ajusta los valores:

```bash
# Supabase Postgres — app en runtime (transaction pooler, 6543)
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=verify-full&sslrootcert=/app/certs/supabase-ca.crt
# Supabase Postgres — migraciones (session pooler, 5432)
MIGRATE_DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require

# Solo para nombres de backup/local tooling
POSTGRES_DB=postgres
POSTGRES_USER=postgres.PROJECT_REF

# Auth
JWT_SECRET=<openssl rand -base64 32>
JWT_REFRESH_SECRET=<openssl rand -base64 32>

# App
NEXT_PUBLIC_APP_URL=https://hisamed.com
NODE_ENV=production

# Cloudflare R2
STORAGE_PROVIDER=r2
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET=ehr-core-attachments
R2_REGION=auto
```

En produccion usa `STORAGE_PROVIDER=r2`. El provider `local` escribe en el filesystem del contenedor y no es persistente para adjuntos clinicos.

Si tu password de Supabase contiene caracteres especiales, usa la version URL-encoded en `DATABASE_URL`.

## Migraciones

Las migraciones de produccion se aplican con:

```bash
pnpm db:migrate:prod
```

Este comando usa `MIGRATE_DATABASE_URL` (session pooler, puerto 5432), que es
la conexion correcta para DDL. Ejecutalo antes de levantar la app por primera
vez y de nuevo despues de desplegar cambios con nuevas migraciones.

> ⚠️ **No** uses el servicio `migrate` de `docker-compose.prod.yml`
> (`docker compose -f docker-compose.prod.yml --profile tools run --rm migrate`)
> para produccion: ese servicio corre `pnpm db:migrate`, que apunta a la DB
> **local** (`MIGRATE_TARGET=local`, lee `DATABASE_URL`). Para produccion usa
> siempre `pnpm db:migrate:prod`.

## Levantar la app

Construir y levantar en produccion:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

La app escucha en `127.0.0.1:3000` — **solo localhost**, no expuesta
publicamente. Caddy va delante y hace el reverse proxy hacia ese puerto.

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
hisamed.com {
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

<!-- NOTA: las rutas /var/backups/hisamed y /var/log/hisamed-backup.log de
     abajo son las esperadas tras renombrar de clinica-mvp a hisamed.
     VERIFICAR contra el servidor real antes de confiar en ellas. -->

Crear un backup manual:

```bash
BACKUP_DIR=/var/backups/hisamed ./scripts/backup-db.sh
```

Con `DATABASE_URL` remoto, el script usa un contenedor temporal `postgres:16-alpine` para correr `pg_dump`. Con la DB local de `docker-compose.yml`, usa `docker compose exec db`.

El archivo queda comprimido como `POSTGRES_DB_YYYYMMDDTHHMMSSZ.sql.gz`. El script borra backups de mas de 30 dias. Puedes cambiar la retencion:

```bash
RETENTION_DAYS=60 BACKUP_DIR=/var/backups/hisamed ./scripts/backup-db.sh
```

Programa cron diario:

```cron
15 3 * * * cd /opt/hisamed && BACKUP_DIR=/var/backups/hisamed ./scripts/backup-db.sh >> /var/log/hisamed-backup.log 2>&1
```

Sincroniza `/var/backups/hisamed` a otro destino, por ejemplo otro servidor, S3/R2 privado o un backup service.

## Restaurar un backup

Para Supabase, planifica una ventana de mantenimiento y detén la app:

```bash
docker compose -f docker-compose.prod.yml stop app
```

Restaurar desde un backup propio:

```bash
gunzip -c /var/backups/hisamed/postgres_20260424T030000Z.sql.gz | docker run --rm -i postgres:16-alpine psql "$DATABASE_URL"
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
