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
 * Enforce one or more limits for a single request. Every spec is consumed
 * (counted) so each independent limit advances; the request is allowed only
 * when every spec is still within budget. `retryAfterSeconds` is the longest
 * wait among the limits that were exceeded.
 */
export async function enforceRateLimits(
  specs: RateLimitSpec[],
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const results = await Promise.all(specs.map((spec) => consumeRateLimit(spec, now)));
  const allowed = results.every((r) => r.allowed);
  return {
    allowed,
    remaining: Math.min(...results.map((r) => r.remaining)),
    retryAfterSeconds: allowed ? 0 : Math.max(...results.map((r) => r.retryAfterSeconds)),
  };
}

/** Clear every window for a key (e.g. a successful login resets failures). */
export async function clearRateLimit(key: string): Promise<void> {
  const keyHash = hashKey(key);
  await db.execute(sql`DELETE FROM rate_limit_buckets WHERE key_hash = ${keyHash}`);
}
