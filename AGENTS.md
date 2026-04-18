<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Date and timezone handling

The app is designed to serve clinics in any timezone. The dev machine, the
production server, and the clinic's users may all live in different
timezones.

## Two kinds of date/time, two sets of rules

Be precise about which kind you are dealing with — the rules below apply
**only to calendar dates**, not to absolute timestamps.

| Kind                    | Examples in this codebase                  | Postgres column   | TZ-sensitive on write? |
|-------------------------|---------------------------------------------|-------------------|------------------------|
| **Calendar date** (no time) | `appointments.date`, `patients.dateOfBirth` | `date`            | YES — "what day it is" depends on TZ |
| **Absolute timestamp**  | `cancelledAt`, `updatedAt`, `createdAt`     | `timestamp`       | NO — an instant is the same everywhere |

For absolute timestamps, just use `new Date()` and pass it straight to
the column. JS Date objects are absolute instants (ms since epoch); they
do not carry a timezone. Drizzle / pg serialize them to UTC and Postgres
stores a single canonical value. Render in any TZ at read time via
`Intl.DateTimeFormat({ timeZone: clinic.timezone })`. Do NOT manually
"convert to clinic TZ before insert" — that produces a different instant
and corrupts the audit trail.

## Rules for calendar dates

1. **Never use `Date#toISOString().split('T')[0]`** to derive a `YYYY-MM-DD`
   string. `toISOString` always returns UTC, so on a UTC server at e.g.
   22:00 in a UTC-4 region it returns the next day's date. Use
   `toDateStr(date)` from `src/lib/dates.ts` instead.

2. **Never compute "today" with `new Date()` on the server.** Always derive
   it from the clinic's timezone via `todayInTz(clinic.timezone)` and pass
   the resulting `YYYY-MM-DD` string down to client components as a prop.
   Server pages should fetch settings via `getClinicSettings(clinicId)`
   from `src/queries/clinic.ts`.

3. **Never assume the week starts on Sunday.** Use
   `getWeekStart(date, weekStartsOn)` with the clinic's `weekStartsOn`
   setting (0 = Sunday, 1 = Monday). Default for new clinics is Monday.

4. **Browser-local `todayStr()`** from `src/lib/dates.ts` is only safe to
   call on the client when the user's own clock is the authoritative
   source (which it usually isn't for a clinic SaaS — prefer the clinic's
   timezone passed from the server).

There are unit tests in `src/lib/__tests__/dates.test.ts` covering the
edge cases around midnight in non-UTC timezones. Run them with
`pnpm test src/lib/__tests__/dates.test.ts`.
