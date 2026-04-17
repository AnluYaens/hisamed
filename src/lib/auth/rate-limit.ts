const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

// Asymmetric semantics between the two functions is intentional:
//   - `checkLoginRateLimit.allowed` → "may this request proceed?" (strict `<`).
//     The (MAX_ATTEMPTS + 1)-th request must be blocked before even checking
//     credentials.
//   - `registerLoginFailure.allowed` → "did this attempt fit inside the quota
//     of MAX_ATTEMPTS?" (inclusive `<=`). The MAX_ATTEMPTS-th failure is still
//     a legitimate bad-credentials response (401); only a subsequent request
//     (or a race past `check`) returns 429.
//
// Trace with MAX_ATTEMPTS=5 and 6 failed attempts:
//   attempts 1..5  → check allows; register sets count=1..5, allowed=true  → 401
//   attempt  6     → check blocks (5 < 5 == false)                         → 429

export function checkLoginRateLimit(key: string, now: number = Date.now()): RateLimitResult {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    return { allowed: true, remaining: MAX_ATTEMPTS, retryAfterSeconds: 0 };
  }
  const remaining = Math.max(0, MAX_ATTEMPTS - bucket.count);
  return {
    allowed: bucket.count < MAX_ATTEMPTS,
    remaining,
    retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

export function registerLoginFailure(key: string, now: number = Date.now()): RateLimitResult {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
    return {
      allowed: true,
      remaining: MAX_ATTEMPTS - 1,
      retryAfterSeconds: Math.ceil(WINDOW_MS / 1000),
    };
  }
  existing.count += 1;
  return {
    // Inclusive: the MAX_ATTEMPTS-th failure itself is still within budget.
    // Only turns false if a race let a (MAX_ATTEMPTS+1)-th request slip past
    // `checkLoginRateLimit`, in which case the caller should respond 429.
    allowed: existing.count <= MAX_ATTEMPTS,
    remaining: Math.max(0, MAX_ATTEMPTS - existing.count),
    retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
  };
}

export function resetLoginAttempts(key: string): void {
  buckets.delete(key);
}
