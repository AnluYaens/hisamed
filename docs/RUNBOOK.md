# Hisamed — Production Runbook

Operational reference for **hisamed.com**. Built for incidents. Scan the table,
jump to the section, run the commands.

> **No secrets in this file.** Real server IPs, account emails, project IDs, R2
> endpoint hashes, and admin emails live in the **private operator notes** (not
> in this repo). Placeholders here: `<PRODUCTION_SERVER_IP>`, `<SSH_USER>`,
> `<DO_ACCOUNT_EMAIL>`, `<SUPABASE_PROJECT_ID>`. Fill from the private notes.

**Stack at a glance:** Next.js (Docker, standalone) on a DigitalOcean VPS →
Caddy reverse proxy (auto HTTPS) → app on `127.0.0.1:3000`. DB = Supabase
Postgres (off-server). Attachments = Cloudflare R2. Email = Resend. Deploy dir
on server = **`/opt/hisamed`**. Compose file = **`docker-compose.prod.yml`**.

SSH in first for almost everything:

```bash
ssh <SSH_USER>@<PRODUCTION_SERVER_IP>
cd /opt/hisamed
```

---

## Quick reference — if X, jump to Y

| Symptom / task | Section |
|---|---|
| Deploy a new version | [Deploy a new version](#deploy-a-new-version) |
| Run prod DB migrations | [Run database migrations](#run-database-migrations) |
| See app / proxy logs | [View logs](#view-logs) |
| Restart the app | [Restart the app](#restart-the-app) |
| Is everything healthy? | [Check service health](#check-service-health) |
| **hisamed.com not loading** | [Site is down](#site-is-down) |
| **Loads but every page 500s** | [App up, errors everywhere](#app-up-errors-on-every-page) |
| **Errors mention DB / connection** | [Database connection failing](#database-connection-failing) |
| **Uploads / attachments fail** | [File uploads failing (R2)](#file-uploads-failing-r2) |
| **History emails not sending** | [Email sending failing (Resend)](#email-sending-failing-resend) |
| **Everything slow** | [Slow response times](#slow-response-times) |
| **Browser cert warning** | [SSL certificate issue](#ssl-certificate-issue) |
| **User says data is gone** | [User reports missing data](#user-reports-missing-data) |
| **Bad deploy — go back** | [Revert the last deploy](#revert-the-last-deploy) |
| **Bad migration — go back** | [Revert a database migration](#revert-a-database-migration) |
| **Restore DB (Supabase)** | [Restore from Supabase backup](#restore-from-a-supabase-backup) |
| **Restore DB (R2 off-site)** | [Restore from R2 off-site backup](#restore-from-the-r2-off-site-backup) |

---

# Routine operations

## Deploy a new version

Deploy is **manual over SSH**. CI (GitHub Actions) runs lint, type-check, tests,
and build on every push to `main` — wait for green before deploying.

On your machine:

```bash
git push origin main
```

On the server:

```bash
ssh <SSH_USER>@<PRODUCTION_SERVER_IP>
cd /opt/hisamed
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

If the release includes new migrations, run them **before** declaring success —
see [Run database migrations](#run-database-migrations).

Verify:

```bash
curl -fsS https://hisamed.com/api/health    # expect {"ok":true,...}
```

Bad deploy → [Revert the last deploy](#revert-the-last-deploy).

> `docker-compose.prod.yml` runs only the `app` service. Postgres is on Supabase,
> not on the VPS.

## Run database migrations

Production migrations run against Supabase via the **session pooler (5432)**,
driven by `MIGRATE_DATABASE_URL`. Run from a checkout with pnpm + deps:

```bash
pnpm db:migrate:prod
```

This is `MIGRATE_TARGET=prod drizzle-kit migrate`.

> ⚠️ **Do NOT** use the in-compose migrate service for production:
> `docker compose -f docker-compose.prod.yml --profile tools run --rm migrate`
> runs `pnpm db:migrate` (`MIGRATE_TARGET=local`) — it targets the **local** DB
> via `DATABASE_URL`, not Supabase. Always use `pnpm db:migrate:prod` for prod.

Take a backup first for anything destructive
([R2 off-site](#restore-from-the-r2-off-site-backup) or confirm Supabase PITR).

## View logs

App (Docker):

```bash
cd /opt/hisamed
docker compose -f docker-compose.prod.yml logs -f app           # follow
docker compose -f docker-compose.prod.yml logs --tail=200 app   # last 200
```

Caddy (reverse proxy / TLS):

```bash
sudo journalctl -u caddy -f
sudo journalctl -u caddy --since "30 min ago"
```

Container state / health:

```bash
docker compose -f docker-compose.prod.yml ps
docker inspect --format '{{.State.Health.Status}}' \
  $(docker compose -f docker-compose.prod.yml ps -q app)
```

## Restart the app

```bash
cd /opt/hisamed
docker compose -f docker-compose.prod.yml restart app
docker compose -f docker-compose.prod.yml ps
curl -fsS https://hisamed.com/api/health
```

Full recreate (picks up `.env` changes):

```bash
docker compose -f docker-compose.prod.yml up -d
```

Caddy (after Caddyfile edits — prefer reload):

```bash
sudo systemctl reload caddy     # zero-downtime
sudo systemctl restart caddy    # only if reload fails
```

## Check service health

| What | How | Healthy looks like |
|---|---|---|
| App | `curl -fsS https://hisamed.com/api/health` | `{"ok":true,"service":"clinica-mvp"}` |
| Container | `docker compose -f docker-compose.prod.yml ps` | `app` `Up`, health `healthy` |
| Uptime | UptimeRobot dashboard | monitor up/green |
| Backup heartbeat | healthchecks.io dashboard | last ping recent, green |
| Database | Supabase dashboard → project `<SUPABASE_PROJECT_ID>` | healthy, not paused |
| DNS / proxy | Cloudflare dashboard | DNS records present |

Dashboard links: [External services](#external-service-dashboards).

---

# Incident playbooks

## Site is down

hisamed.com not responding at all.

1. Confirm scope:

   ```bash
   curl -I https://hisamed.com
   curl -fsS https://hisamed.com/api/health
   ```

   Cross-check UptimeRobot.

2. SSH in:

   ```bash
   ssh <SSH_USER>@<PRODUCTION_SERVER_IP> && cd /opt/hisamed
   ```

   SSH fails → server/network down → DigitalOcean dashboard (droplet status,
   reboot/console).

3. App container up?

   ```bash
   docker compose -f docker-compose.prod.yml ps
   docker compose -f docker-compose.prod.yml logs --tail=100 app
   ```

   Not running / crash-looping → [Restart the app](#restart-the-app). Crash on
   boot usually = bad migration, missing `.env` var, or DB unreachable →
   [Database connection failing](#database-connection-failing).

4. App up on `:3000` but site down → proxy:

   ```bash
   curl -fsS http://127.0.0.1:3000/api/health   # app itself OK?
   sudo systemctl status caddy
   sudo journalctl -u caddy --since "15 min ago"
   sudo systemctl reload caddy
   ```

5. App + Caddy fine but unreachable externally → DNS / firewall: check
   Cloudflare DNS and that ports 80/443 are open.

## App up, errors on every page

Loads but every page 500s.

1. Read the stack trace:

   ```bash
   docker compose -f docker-compose.prod.yml logs --tail=200 app
   ```

2. Common causes:
   - **DB unreachable** → [Database connection failing](#database-connection-failing).
   - **Bad migration / schema mismatch** after deploy →
     [Revert a database migration](#revert-a-database-migration) or roll the app
     back: [Revert the last deploy](#revert-the-last-deploy).
   - **Missing/invalid env var** (`JWT_SECRET`, DB URL, etc.). Fix `.env`, then
     `docker compose -f docker-compose.prod.yml up -d`.

3. Started right after a deploy and cause unclear → roll back first, diagnose
   later: [Revert the last deploy](#revert-the-last-deploy).

## Database connection failing

Errors mention Postgres / connection / SSL / pooler.

1. Supabase healthy and **not paused**? Supabase dashboard → project
   `<SUPABASE_PROJECT_ID>`. Resume if paused.

2. Connection strings in `/opt/hisamed/.env`:
   - App runtime → `DATABASE_URL` = **transaction pooler (6543)**,
     `sslmode=verify-full&sslrootcert=/app/certs/supabase-ca.crt`.
   - Migrations → `MIGRATE_DATABASE_URL` = **session pooler (5432)**.

3. Connectivity test from the server:

   ```bash
   set -a; . /opt/hisamed/.env; set +a
   docker run --rm postgres:16-alpine psql "$DATABASE_URL" -c "select 1;"
   ```

4. Supabase OK but app can't connect → restart to drop stale pooled
   connections: [Restart the app](#restart-the-app).

5. "too many connections" → check pooler limits in the Supabase dashboard.

## File uploads failing (R2)

Attachments won't upload or won't load.

1. Provider must be R2: `STORAGE_PROVIDER=r2` in `.env`. (`local` writes to the
   ephemeral container FS and is invalid for prod.)

2. Required vars present (`src/lib/storage.ts` throws if missing):
   `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
   (`R2_REGION` defaults to `auto`).

3. Logs during a failed upload:

   ```bash
   docker compose -f docker-compose.prod.yml logs -f app
   ```

   `R2 credentials missing` → vars unset. `403` → bad keys. `404 / NoSuchBucket`
   → wrong bucket.

4. Cloudflare dashboard → R2: bucket exists, API token not expired/revoked, not
   over quota.

5. Keys rotated → update `.env`, then
   `docker compose -f docker-compose.prod.yml up -d`.

## Email sending failing (Resend)

"Enviar historial por correo" fails or emails don't arrive.

1. Vars present (`src/lib/email/resend.ts`): `RESEND_API_KEY`,
   `RESEND_FROM_EMAIL` (`RESEND_FROM_NAME` defaults to `Hisamed`). If
   `RESEND_API_KEY` is unset the feature is **disabled by design** with a clear
   error — expected, not a bug.

2. Logs for the send attempt:

   ```bash
   docker compose -f docker-compose.prod.yml logs -f app
   ```

3. Resend dashboard → Emails/Logs: bounced, blocked, or API error. Confirm the
   API key is active and the sending domain is verified.

4. Domain auth (SPF/DKIM) lives in Cloudflare DNS. If recently changed, verify
   propagation.

## Slow response times

1. Server load:

   ```bash
   uptime
   docker stats --no-stream
   df -h          # disk full? backups dir filling up?
   ```

2. App logs for slow queries / errors:
   `docker compose -f docker-compose.prod.yml logs --tail=200 app`.

3. Supabase dashboard → DB load, slow queries, pooler connection limit.

4. Disk full → prune:

   ```bash
   docker image prune -f
   ```

5. Restart to clear a degraded state if needed:
   [Restart the app](#restart-the-app).

## SSL certificate issue

Cert warning / expired. Caddy auto-issues + renews via Let's Encrypt, so this
usually means renewal is blocked.

1. Caddy status + logs:

   ```bash
   sudo systemctl status caddy
   sudo journalctl -u caddy --since "1 hour ago" | grep -iE "cert|acme|tls|error"
   ```

2. Ports **80 and 443** must be open (ACME HTTP-01 needs 80). Confirm firewall;
   no other process holding them.

3. DNS must resolve hisamed.com → `<PRODUCTION_SERVER_IP>`. If Cloudflare proxy
   (orange cloud) is on, SSL mode must be Full/Full-strict — a mismatch causes
   cert/redirect loops. (Prod runs grey-cloud / DNS-only so Caddy controls TLS.)

4. Force a retry:

   ```bash
   sudo systemctl reload caddy
   ```

## User reports missing data

A user says appointments/patients/records are gone. **Do not restore anything
yet** — confirm it's actually lost.

1. Scope it: one record, one patient, or everything? One user or all? Get exact
   names/dates and the user's clinic (multi-tenant — data is scoped per clinic).

2. Likely-benign before assuming data loss:
   - **Wrong clinic / tenant scoping** — record belongs to another clinic.
   - **Timezone confusion** — calendar dates (`appointments.date`,
     `dateOfBirth`) render in the *clinic's* timezone. A record can look
     "missing from today" when viewing the wrong day. See `AGENTS.md` date rules.
   - **Soft delete** (`is_active=false`) vs hard delete.

3. Confirm against the DB (read-only) before any restore — Supabase SQL editor,
   or:

   ```bash
   set -a; . /opt/hisamed/.env; set +a
   docker run --rm postgres:16-alpine psql "$DATABASE_URL" -c "<scoped SELECT>"
   ```

4. Genuinely deleted → identify *when*, then prefer **Supabase PITR** to just
   before the loss ([Restore from Supabase backup](#restore-from-a-supabase-backup));
   else the [R2 off-site dump](#restore-from-the-r2-off-site-backup). Restoring
   overwrites — weigh recovering one record by hand vs. a full restore that
   reverts other recent writes.

---

# Rollback procedures

## Revert the last deploy

App is code-only here; reverting = check out the previous commit and rebuild.

```bash
cd /opt/hisamed
git log --oneline -5            # note the previous good SHA
git checkout <PREVIOUS_GOOD_SHA>
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl -fsS https://hisamed.com/api/health
```

Return to tip later: `git checkout main`.

> If the bad deploy included a migration, code rollback alone may not be enough —
> the schema moved forward. See
> [Revert a database migration](#revert-a-database-migration). Once the incident
> is over, prefer a proper `git revert` on `main` + redeploy.

## Revert a database migration

drizzle-kit migrations are **forward-only** — there are no auto-generated `down`
migrations.

1. **Preferred — roll forward:** write a new migration that reverses the change,
   commit, deploy, run `pnpm db:migrate:prod`.

2. **Data lost / destructive change:** restore the DB from a backup taken
   *before* the migration:
   - [Restore from a Supabase backup](#restore-from-a-supabase-backup) (PITR), or
   - [Restore from the R2 off-site backup](#restore-from-the-r2-off-site-backup).

> ⚠️ Never hand-edit the drizzle migrations journal / `__drizzle_migrations`
> table on prod to "skip" a migration without understanding the schema state —
> you'll desync tracking.

## Restore from a Supabase backup

Preferred restore path — operationally safer than a manual dump.

1. Maintenance window; stop the app to prevent writes:

   ```bash
   cd /opt/hisamed
   docker compose -f docker-compose.prod.yml stop app
   ```

2. Supabase dashboard → your project → **Database → Backups** (and **PITR** if
   on the plan): pick the restore point, follow the guided restore. Link in
   [External services](#external-service-dashboards).

3. Bring the app back:

   ```bash
   docker compose -f docker-compose.prod.yml up -d
   curl -fsS https://hisamed.com/api/health
   ```

4. Spot-check the data that prompted the restore.

## Restore from the R2 off-site backup

Off-site dumps are pushed to Cloudflare R2 by the server cron job
**`/opt/hisamed/scripts/backup-to-r2.sh`** (gzipped `pg_dump`). They live in the
R2 bucket under the **`db-backups/`** prefix, accessed via the rclone remote
**`r2:`**.

1. List available dumps (newest last):

   ```bash
   rclone ls r2:<R2_BUCKET_NAME>/db-backups/
   ```

2. Download the chosen dump:

   ```bash
   rclone copy r2:<R2_BUCKET_NAME>/db-backups/<DUMP_FILE>.sql.gz /tmp/
   ```

3. Maintenance window; stop the app:

   ```bash
   cd /opt/hisamed
   docker compose -f docker-compose.prod.yml stop app
   ```

4. Restore into Supabase:

   ```bash
   set -a; . /opt/hisamed/.env; set +a
   gunzip -c /tmp/<DUMP_FILE>.sql.gz \
     | docker run --rm -i postgres:16-alpine psql "$DATABASE_URL"
   ```

5. **Only if** you must wipe the schema first (after confirming the dump is
   valid):

   ```bash
   docker run --rm postgres:16-alpine psql "$DATABASE_URL" \
     -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   ```

6. Bring the app back and verify:

   ```bash
   docker compose -f docker-compose.prod.yml up -d
   curl -fsS https://hisamed.com/api/health
   ```

---

# External service dashboards

No credentials here. Logins are in the password manager. Project-specific IDs
are in the private operator notes.

| Service | Use | Where to look |
|---|---|---|
| **DigitalOcean** | VPS / droplet (the server) | DO dashboard, account `<DO_ACCOUNT_EMAIL>` → Droplets. Reboot, console, networking, bandwidth. |
| **Supabase** | Postgres DB + managed backups / PITR | Supabase dashboard → project `<SUPABASE_PROJECT_ID>` → Database → Backups; SQL editor; connection strings under Connect. |
| **Cloudflare** | DNS, R2 storage, email routing | Cloudflare dashboard → zone `hisamed.com` (DNS), R2 (attachments + `db-backups/`), Email Routing. |
| **Resend** | Transactional email (history PDFs) | Resend dashboard → Emails/Logs, API Keys, Domains. |
| **UptimeRobot** | Uptime monitoring + alerts | UptimeRobot dashboard → hisamed.com monitor. |
| **healthchecks.io** | Backup-cron heartbeat | healthchecks.io dashboard → backup check. A late/missing ping = the backup didn't run. |

> **TODO:** paste the concrete dashboard URLs into the private operator notes —
> they are intentionally omitted here.

---

# Pre-incident checklist

So 2am-you isn't discovering a broken backup for the first time.

### Weekly

- [ ] **R2 off-site backups present + recent.** Newest object under
  `db-backups/` is from the last 24h:

  ```bash
  rclone ls r2:<R2_BUCKET_NAME>/db-backups/
  ```

- [ ] **Supabase daily backups visible** in the dashboard (Database → Backups),
  retention as expected.

- [ ] **Monitors green:** UptimeRobot up; **last healthchecks.io ping recent**
  (a missed ping means the backup cron didn't run).

- [ ] **Health endpoint OK:** `curl -fsS https://hisamed.com/api/health`.

- [ ] **TLS cert not erroring** (Caddy auto-renews; just check
  `journalctl -u caddy` for ACME errors).

### Monthly

- [ ] **Test-restore** the latest R2 dump into a throwaway/staging DB — a backup
  you've never restored is a hope, not a backup.

- [ ] **Supabase backups/PITR confirmed**, not at connection/storage limits.

- [ ] **Disk headroom** on the VPS: `df -h`; `docker image prune -f` if tight.

- [ ] **Secrets/keys** — R2 keys, Resend key, JWT secrets not expired or due for
  rotation.

- [ ] **Base image / deps** — plan updates for `node:20-alpine` and app deps.

---

## TODOs flagged in this runbook

Called out inline above; need verification against the live server / private
notes:

1. **Dashboard URLs / infra identifiers** — fill the private operator notes
   (DO account, Supabase project ref, R2 bucket name, server IP, SSH user). See
   [External services](#external-service-dashboards).
