import 'dotenv/config';
import { cleanupStaleRateLimitBuckets, STALE_BUCKET_THRESHOLD_MS } from '../src/lib/rate-limit';

/**
 * Periodic cleanup of stale `rate_limit_buckets` rows.
 *
 * The limiter already prunes opportunistically on write (see `maybeSweep` in
 * `src/lib/rate-limit.ts`), so the table normally stays bounded on its own.
 * This script is a backstop for keys that are never hit again and would
 * otherwise leave a row behind indefinitely.
 *
 * Production ops can wire this into a cron job (e.g. once a day) or run it by
 * hand. It is safe to run at any time and as often as desired: it only
 * deletes buckets whose window started longer ago than the threshold, which
 * is far beyond the longest window the limiter uses — active / current-window
 * counters are never touched.
 *
 * Usage:
 *   pnpm db:cleanup-rate-limits            # default 48h threshold
 *   pnpm db:cleanup-rate-limits -- 168     # custom threshold in hours (7 days)
 */
async function main() {
  const hoursArg = process.argv[2];
  const olderThanMs = hoursArg
    ? Number(hoursArg) * 60 * 60 * 1000
    : STALE_BUCKET_THRESHOLD_MS;

  if (!Number.isFinite(olderThanMs) || olderThanMs <= 0) {
    console.error(`Umbral inválido: "${hoursArg}". Pasa un número de horas positivo.`);
    process.exit(1);
  }

  const hours = Math.round(olderThanMs / (60 * 60 * 1000));
  console.log(`Limpiando rate_limit_buckets con ventanas anteriores a ${hours}h...`);

  const deleted = await cleanupStaleRateLimitBuckets(olderThanMs);
  console.log(`✅ Listo. Filas eliminadas: ${deleted}.`);

  // The shared db Pool from `@/lib/db` has no exposed close — exit explicitly.
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
