# Hisamed

A modern, multi-tenant electronic health record (EHR) system for private medical practices in Latin America.

**Live at [hisamed.com](https://hisamed.com) · [Try the demo](https://hisamed.com/demo) (no signup required)**

**Status:** Production. Pilot live with one clinic; ~4,000 patients migrated from a legacy system.

---

## What it is

Across Latin America, private-practice doctors still run their patient records on offline desktop EHRs from the early 2000s; most commonly **HipoSEMG XXI**, a free Spanish desktop application. These tools are bound to a single computer, have no real backups, and lose patient records when the machine crashes or is lost.

Hisamed is the cloud-based alternative, built around how LATAM private practices actually operate. It is **doctor-centric**: the doctor owns the software and the data, not an institution. Records are available from any device, backed up automatically, and isolated per clinic.

It started as a personal project to replace the software used in the author's father's gynecology practice, and is now opening to other doctors. Built solo by **Angel Jaen**, a software engineering student at Macromedia University Berlin, as a real production project for his father's practice.

## Technical highlights

- **Production data migration** — 4,099 real patient records migrated from a legacy Microsoft Access export, with date-format ambiguities, ID-field reassignments, and 27 duplicate records caught and handled before any production write.
- **Multi-tenant data isolation** — 39 automated tests against a real Postgres database assert that clinic A cannot reach clinic B's data across every surface: patients, clinical notes, attachments, documents, audit logs, exports, and global search.
- **Read-only demo account with a CI-enforced static guard** — every server action must either contain the demo check or be explicitly listed in an allowlist, or CI fails.
- **Multi-language landing page** — Spanish by default with an English toggle; the application itself is in Spanish (the target market).
- **Installable PWA** on desktop and mobile, with local draft persistence for clinical notes and patient forms so an internet drop doesn't lose in-progress work.
- **Layered backups** — daily Supabase backups plus a weekly off-site backup to Cloudflare R2, with a healthchecks.io heartbeat that alerts on a missed run.
- **Custom JWT auth** (argon2id) with rotating refresh tokens, rate-limited login, and audit logging.

## Stack

- **Framework:** Next.js 16 (App Router, Server Components, Server Actions)
- **Language:** TypeScript (strict)
- **Database:** PostgreSQL via Supabase (US East), Drizzle ORM
- **File storage:** Cloudflare R2 (S3-compatible)
- **Hosting:** DigitalOcean Droplet, Docker, Caddy (auto-TLS)
- **Email:** Resend (transactional) + Cloudflare Email Routing (incoming)
- **Monitoring:** UptimeRobot, healthchecks.io

## Architecture

The application layer is **stateless** and therefore replicable: it holds no session state locally, so instances can be added or replaced without coordination. Authentication rides on signed JWTs, and uploads go straight to object storage rather than local disk.

Compute, database, and file storage are **deliberately separated** into independent services (the app on a DigitalOcean Droplet, Postgres on Supabase, files on Cloudflare R2). Each can scale, fail, and be restored on its own without touching the others.

Multi-tenancy is enforced by a `clinic_id` boundary present on every tenant-owned table. Isolation is applied at the query layer — every read and write is scoped to the caller's clinic — and is verified continuously by the cross-tenant test suite rather than trusted by convention. Operational details (deploys, restores, incident runbooks) live in [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Repository layout

| Directory  | Contents                                                                       |
| ---------- | ------------------------------------------------------------------------------ |
| `src/`     | Application code — App Router routes, server actions, queries, lib, components |
| `scripts/` | Operational scripts — data migration, backups, admin/seed utilities            |
| `docs/`    | Product, deployment, and operational runbook documentation                     |
| `public/`  | Static assets, PWA manifest assets, and service worker                         |
| `tests/`   | Unit/integration (Vitest) and end-to-end (Playwright) test suites              |
| `legal/`   | Terms, privacy policy, and DPA (Spanish and English)                           |

## Running locally

```bash
git clone <repo-url> hisamed && cd hisamed
pnpm install

# Start a local Postgres (defined in docker-compose.yml)
docker compose up -d db

cp .env.example .env        # fill in the local values

pnpm db:migrate             # apply schema migrations
pnpm db:seed-demo           # populate the demo clinic locally

pnpm dev                    # http://localhost:3000
```

## Testing

All tests run against a real Postgres database — there are no mocked queries, because the isolation guarantees can only be proven against real SQL. The suite is **325 unit and integration tests** (Vitest), plus end-to-end coverage of the core flows with Playwright. Database-dependent suites self-skip when no Postgres instance is reachable.

```bash
pnpm test          # unit + integration (Vitest)
pnpm test:e2e      # end-to-end (Playwright)
```

## License / status

**This is NOT open source. All rights reserved.** The source is published privately for review and demonstration purposes only.

There is no public contribution or fork policy. No permission is granted to use, copy, modify, deploy, or distribute this code; see [LICENSE](LICENSE).

Hisamed is operated by Angel Jaen, an independent developer based in Germany.

Contact: [legal@hisamed.com](mailto:legal@hisamed.com).
