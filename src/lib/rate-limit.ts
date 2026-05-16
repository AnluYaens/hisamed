import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

/**
 * DB-backed fixed-window rate limiter.
 *
 * Why DB-backed and not in-memory: this app is deployed as a stateless
 * Node server (Supabase Postgres behind it) and is expected to scale to
 * more than one instance / serverless invocation. An in-memory Map only
 * sees the requests that happen to land on the same process, so under
 * multiple instances an attacker simply spreads requests across them and
 * the limit never triggers. A single shared Postgres table gives every
 * instance the same view. The cost is one tiny upsert per protected
 * request, which is negligible next to the work being protected (PDF
 * generation, Resend calls, R2 transfers).
 *
 * Privacy: the logical key (which may contain an IP or email) is never
 * stored. Only its SHA-256 hex digest reaches the database, and no PDF
 * content, file name or other PHI is ever part of a key.
 */

export interface RateLimitSpec {
  /** Logical key, e.g. `login:ip:1.2.3.4`. Hashed before it touches the DB. */
  key: string;
  /** Maximum number of requests allowed within the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests still available in the current window (never negative). */
  remaining: number;
  /** Seconds the caller should wait before retrying. 0 when allowed. */
  retryAfterSeconds: number;
}

// SHA-256 digest of the raw key. Keeps IPs / emails out of the database
// while still being a stable, fixed-length (64 hex chars) bucket id.
function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// Start of the current fixed window, in epoch milliseconds.
function windowStartMs(now: number, windowSeconds: number): number {
  const windowMs = windowSeconds * 1000;
  return Math.floor(now / windowMs) * windowMs;
}

function retryAfter(windowStart: number, windowSeconds: number, now: number): number {
  return Math.max(1, Math.ceil((windowStart + windowSeconds * 1000 - now) / 1000));
}

// Best-effort prune of stale rows. Runs on a small fraction of writes so the
// table cannot grow unbounded from abandoned keys, without adding a write to
// every request. Two hours comfortably covers every window we use.
async function maybeSweep(now: number): Promise<void> {
  if (Math.random() >= 0.02) return;
  try {
    await db.execute(
      sql`DELETE FROM rate_limit_buckets WHERE window_start < ${now - 2 * 60 * 60 * 1000}`,
    );
  } catch {
    // Cleanup is opportunistic — never let it affect the request.
  }
}

/**
 * Read the current bucket WITHOUT counting this request against it.
 * Use before deciding whether expensive work may proceed when the request
 * itself should only be counted on a specific outcome (e.g. a failed login).
 */
export async function checkRateLimit(
  spec: RateLimitSpec,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const windowStart = windowStartMs(now, spec.windowSeconds);
  const keyHash = hashKey(spec.key);

  const result = await db.execute<{ count: number }>(sql`
    SELECT count FROM rate_limit_buckets
    WHERE key_hash = ${keyHash} AND window_start = ${windowStart}
  `);
  const count = Number(result.rows[0]?.count ?? 0);

  return {
    allowed: count < spec.limit,
    remaining: Math.max(0, spec.limit - count),
    retryAfterSeconds: count < spec.limit ? 0 : retryAfter(windowStart, spec.windowSeconds, now),
  };
}

/**
 * Atomically count this request against the bucket and report whether it
 * fit inside the limit. The increment always happens (so a denied request
 * still extends the penalty window); `allowed` is false once the running
 * count exceeds `limit`.
 */
export async function consumeRateLimit(
  spec: RateLimitSpec,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const windowStart = windowStartMs(now, spec.windowSeconds);
  const keyHash = hashKey(spec.key);

  // Single atomic upsert — no read-modify-write race even under concurrent
  // requests for the same key.
  const result = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limit_buckets (key_hash, window_start, count)
    VALUES (${keyHash}, ${windowStart}, 1)
    ON CONFLICT (key_hash, window_start)
    DO UPDATE SET count = rate_limit_buckets.count + 1
    RETURNING count
  `);
  const count = Number(result.rows[0]?.count ?? 1);

  // Drop this key's older windows so each active key keeps ~one row.
  try {
    await db.execute(
      sql`DELETE FROM rate_limit_buckets WHERE key_hash = ${keyHash} AND window_start < ${windowStart}`,
    );
  } catch {
    // Non-fatal — the window_start index keeps the global sweep cheap.
  }
  await maybeSweep(now);

  return {
    allowed: count <= spec.limit,
    remaining: Math.max(0, spec.limit - count),
    retryAfterSeconds: count <= spec.limit ? 0 : retryAfter(windowStart, spec.windowSeconds, now),
  };
}

/**
 * Enforce one or more limits for a single request. Specs are consumed in
 * order and consumption stops at the first spec that denies — a request that
 * is already going to be rejected must not burn an unrelated later bucket.
 * Otherwise a client throttled by, say, a per-patient limit would also lose
 * budget against its independent per-user limit for work it never performed,
 * silently shrinking the real ceiling of the later limit. The request is
 * allowed only when every spec is still within budget; when denied,
 * `retryAfterSeconds` is the wait reported by the spec that tripped.
 *
 * Order therefore matters: list the most specific / cheapest-to-exhaust spec
 * first so it shields the broader ones.
 */
export async function enforceRateLimits(
  specs: RateLimitSpec[],
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const consumed: RateLimitResult[] = [];
  for (const spec of specs) {
    const result = await consumeRateLimit(spec, now);
    consumed.push(result);
    if (!result.allowed) {
      return { allowed: false, remaining: 0, retryAfterSeconds: result.retryAfterSeconds };
    }
  }
  return {
    allowed: true,
    remaining: consumed.length ? Math.min(...consumed.map((r) => r.remaining)) : 0,
    retryAfterSeconds: 0,
  };
}

/** Clear every window for a key (e.g. a successful login resets failures). */
export async function clearRateLimit(key: string): Promise<void> {
  const keyHash = hashKey(key);
  await db.execute(sql`DELETE FROM rate_limit_buckets WHERE key_hash = ${keyHash}`);
}

/**
 * Staleness threshold for the bulk cleanup helper: 48 hours. This is far
 * beyond the longest window the limiter currently uses (1h), so a bucket
 * older than this cannot possibly belong to a window that is still current —
 * the cleanup never deletes an active counter.
 */
export const STALE_BUCKET_THRESHOLD_MS = 48 * 60 * 60 * 1000;

/**
 * Delete every rate-limit bucket whose window started more than `olderThanMs`
 * ago. A belt-and-suspenders backstop to the opportunistic per-write sweep in
 * `maybeSweep` / `consumeRateLimit`: those already keep the table bounded, but
 * a key that is never touched again would otherwise leave a stale row forever.
 *
 * Production ops can run this periodically (cron) or manually via
 * `pnpm db:cleanup-rate-limits` — see `scripts/cleanup-rate-limits.ts`.
 *
 * The default threshold (48h) is intentionally well past the longest window
 * in use, so this only ever removes buckets whose window has long since
 * closed; current-window / active buckets are never deleted.
 *
 * @returns the number of rows deleted.
 */
export async function cleanupStaleRateLimitBuckets(
  olderThanMs: number = STALE_BUCKET_THRESHOLD_MS,
  now: number = Date.now(),
): Promise<number> {
  const cutoff = now - olderThanMs;
  const result = await db.execute(
    sql`DELETE FROM rate_limit_buckets WHERE window_start < ${cutoff}`,
  );
  return result.rowCount ?? 0;
}
