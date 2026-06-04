// Shared, read-only demo account.
//
// A single demo clinic that every "Probar demo" visitor logs into (see
// /demo route handler and scripts/seed-demo.ts). The account is read-only:
// any mutating Server Action or Route Handler must call the guard below and
// bail with a friendly message instead of writing, so the sample data never
// changes no matter what visitors do.
//
// Identity is recognised by the clinic id, not a schema column — this keeps
// the seed and the runtime in lockstep without a migration, and naturally
// rides on the existing multi-tenant isolation: a demo session can only ever
// read rows scoped to DEMO_CLINIC_ID.
//
// The ids are fixed (not random) so the seed script and the app agree on who
// the demo tenant is. They are overridable via env for staging/prod where the
// seeded ids may differ, but default to these constants for local dev.

import type { Session } from '@/lib/auth/session';

/** Fixed demo clinic id. Override with DEMO_CLINIC_ID in the environment. */
export const DEMO_CLINIC_ID =
  process.env.DEMO_CLINIC_ID?.trim() || 'dededede-0000-4000-8000-000000000001';

/** Fixed demo doctor user id. Override with DEMO_USER_ID in the environment. */
export const DEMO_USER_ID =
  process.env.DEMO_USER_ID?.trim() || 'dededede-0000-4000-8000-000000000002';

/** Login email for the demo doctor. */
export const DEMO_USER_EMAIL = 'demo@hisamed.com';

/** Friendly message shown when a demo visitor attempts to write. */
export const DEMO_READONLY_MESSAGE =
  'Esta cuenta es solo de demostración. Los cambios no se guardarán.';

/** True when the session belongs to the shared demo clinic. */
export function isDemoSession(session: Pick<Session, 'clinicId'>): boolean {
  return session.clinicId === DEMO_CLINIC_ID;
}

/**
 * Standard read-only failure payload for Server Actions. Shaped as the common
 * `{ success: false; error }` so it is assignable to every action's state
 * union (including `FormFailure`, whose other fields are optional).
 */
export function demoWriteBlocked(): { success: false; error: string } {
  return { success: false as const, error: DEMO_READONLY_MESSAGE };
}
