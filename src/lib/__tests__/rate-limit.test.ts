import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: { execute: mocks.execute },
}));

import {
  checkRateLimit,
  consumeRateLimit,
  enforceRateLimits,
  clearRateLimit,
  cleanupStaleRateLimitBuckets,
  STALE_BUCKET_THRESHOLD_MS,
} from '@/lib/rate-limit';

// The helper issues several statements per call (upsert + prune + sweep).
// `countSequence` answers each count-bearing statement (the INSERT upsert or
// a `SELECT count`) with the next supplied value; bookkeeping DELETEs resolve
// to an empty result. Matching on the SQL text keeps this stable whether the
// caller consumes specs in parallel or sequentially.
function countSequence(...counts: number[]) {
  let i = 0;
  mocks.execute.mockImplementation(async (query: unknown) => {
    const text = JSON.stringify(query);
    const isCountStatement = text.includes('INSERT INTO') || text.includes('SELECT count');
    if (isCountStatement && i < counts.length) {
      return { rows: [{ count: counts[i++] }] };
    }
    return { rows: [] };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: every statement resolves harmlessly.
  mocks.execute.mockResolvedValue({ rows: [] });
});

describe('consumeRateLimit', () => {
  it('allows while the running count stays within the limit', async () => {
    countSequence(3);
    const res = await consumeRateLimit({ key: 'k', limit: 5, windowSeconds: 600 });
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(2);
    expect(res.retryAfterSeconds).toBe(0);
  });

  it('allows the request that exactly reaches the limit', async () => {
    countSequence(5);
    const res = await consumeRateLimit({ key: 'k', limit: 5, windowSeconds: 600 });
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(0);
  });

  it('denies once the count exceeds the limit and reports Retry-After', async () => {
    countSequence(6);
    const now = 1_000_000_000_000;
    const res = await consumeRateLimit({ key: 'k', limit: 5, windowSeconds: 600 }, now);
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.retryAfterSeconds).toBeLessThanOrEqual(600);
  });

  it('hashes the key — the raw key never reaches the database', async () => {
    countSequence(1);
    const rawKey = 'login:email-ip:secret@example.com:1.2.3.4';
    await consumeRateLimit({ key: rawKey, limit: 5, windowSeconds: 600 });

    const expectedHash = createHash('sha256').update(rawKey).digest('hex');
    const firstStatement = JSON.stringify(mocks.execute.mock.calls[0]?.[0]);
    expect(firstStatement).toContain(expectedHash);
    expect(firstStatement).not.toContain('secret@example.com');
    expect(firstStatement).not.toContain('1.2.3.4');
  });
});

describe('checkRateLimit', () => {
  it('reports allowed without an empty bucket counting as a hit', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] });
    const res = await checkRateLimit({ key: 'k', limit: 10, windowSeconds: 600 });
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(10);
  });

  it('denies when the existing count already meets the limit', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [{ count: 10 }] });
    const res = await checkRateLimit({ key: 'k', limit: 10, windowSeconds: 600 });
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe('enforceRateLimits', () => {
  it('is allowed only when every spec is within budget', async () => {
    countSequence(1, 1);
    const res = await enforceRateLimits([
      { key: 'a', limit: 5, windowSeconds: 600 },
      { key: 'b', limit: 5, windowSeconds: 600 },
    ]);
    expect(res.allowed).toBe(true);
  });

  it('is denied when any single spec is exceeded', async () => {
    countSequence(1, 99);
    const res = await enforceRateLimits([
      { key: 'a', limit: 5, windowSeconds: 600 },
      { key: 'b', limit: 5, windowSeconds: 600 },
    ]);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('does not consume a later bucket once an earlier spec is denied', async () => {
    // The first spec is already over budget — the request is doomed, so the
    // second spec's bucket must never be written.
    countSequence(99);
    const res = await enforceRateLimits([
      { key: 'first', limit: 5, windowSeconds: 600 },
      { key: 'second', limit: 5, windowSeconds: 600 },
    ]);
    expect(res.allowed).toBe(false);

    const firstHash = createHash('sha256').update('first').digest('hex');
    const secondHash = createHash('sha256').update('second').digest('hex');
    const statements = mocks.execute.mock.calls.map((c) => JSON.stringify(c[0]));
    // The first spec was consumed...
    expect(statements.some((s) => s.includes(firstHash))).toBe(true);
    // ...but the second spec's bucket was never touched at all.
    expect(statements.some((s) => s.includes(secondHash))).toBe(false);
  });
});

describe('clearRateLimit', () => {
  it('issues a delete for the hashed key', async () => {
    await clearRateLimit('some-key');
    expect(mocks.execute).toHaveBeenCalledOnce();
    const stmt = JSON.stringify(mocks.execute.mock.calls[0]?.[0]);
    expect(stmt).toContain(createHash('sha256').update('some-key').digest('hex'));
  });
});

describe('cleanupStaleRateLimitBuckets', () => {
  it('deletes buckets older than the cutoff and never current-window ones', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [], rowCount: 7 });
    const now = 1_000_000_000_000;
    const deleted = await cleanupStaleRateLimitBuckets(STALE_BUCKET_THRESHOLD_MS, now);

    expect(deleted).toBe(7);
    const stmt = JSON.stringify(mocks.execute.mock.calls[0]?.[0]);
    expect(stmt).toContain('DELETE FROM rate_limit_buckets');
    // Only windows that started before `now - threshold` are removed; any
    // active/current-window bucket has a far larger window_start than this.
    expect(stmt).toContain(String(now - STALE_BUCKET_THRESHOLD_MS));
  });

  it('default threshold (48h) is well past the longest window in use (1h)', () => {
    // Guarantees the cutoff can never fall inside a still-open window, so a
    // current/active counter is never a deletion candidate.
    const longestWindowMs = 3600 * 1000;
    expect(STALE_BUCKET_THRESHOLD_MS).toBeGreaterThan(longestWindowMs);
  });

  it('reports zero when the driver returns no rowCount', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] });
    const deleted = await cleanupStaleRateLimitBuckets();
    expect(deleted).toBe(0);
  });
});
