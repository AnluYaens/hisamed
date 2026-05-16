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
} from '@/lib/rate-limit';

// The helper issues several statements per call (upsert + prune + sweep).
// `countSequence` answers each `RETURNING count` / `SELECT count` query with
// the next supplied value; bookkeeping statements resolve to an empty result.
function countSequence(...counts: number[]) {
  let i = 0;
  mocks.execute.mockImplementation(async () => {
    // A DELETE has no RETURNING — drizzle still resolves to { rows: [] }.
    // Only the first statement of each consume/check call reads a count.
    if (i < counts.length) {
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
});

describe('clearRateLimit', () => {
  it('issues a delete for the hashed key', async () => {
    await clearRateLimit('some-key');
    expect(mocks.execute).toHaveBeenCalledOnce();
    const stmt = JSON.stringify(mocks.execute.mock.calls[0]?.[0]);
    expect(stmt).toContain(createHash('sha256').update('some-key').digest('hex'));
  });
});
