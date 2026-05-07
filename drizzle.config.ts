import { defineConfig } from 'drizzle-kit';

// MIGRATE_DATABASE_URL: session pooler (port 5432, IPv4-only) — required for DDL migrations from WSL2
// DATABASE_URL: transaction pooler (port 6543) — used by the app at runtime
const rawUrl = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!rawUrl) throw new Error('MIGRATE_DATABASE_URL or DATABASE_URL must be set');

// pg v8+ treats sslmode=require as verify-full; Supabase uses its own CA so verification fails.
// uselibpqcompat=true restores libpq semantics: require = encrypt without cert verification.
const url = rawUrl.includes('uselibpqcompat')
  ? rawUrl
  : rawUrl.replace(/(\?|&)(sslmode=require)/, '$1$2&uselibpqcompat=true');

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
