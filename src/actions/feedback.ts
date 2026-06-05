'use server';

import { eq } from 'drizzle-orm';
import { feedbackSchema, FEEDBACK_CATEGORY_LABELS } from '@/lib/validators/feedback';
import { getResendConfig, sendFeedbackEmail } from '@/lib/email/resend';
import { consumeRateLimit } from '@/lib/rate-limit';
import { getClientIpFromHeaders } from '@/lib/audit';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { formFailure, type FormFailure } from '@/lib/forms/state';

export type FeedbackState = null | { success: true } | FormFailure;

// Shared backend for both feedback surfaces (the dashboard popover and the
// landing-page section). Validates with Zod, rate-limits per IP to blunt spam,
// and emails the message to support via the existing Resend integration. No DB
// table — see sendFeedbackEmail for the rationale.
//
// NOTE: this action intentionally does NOT carry the demo read-only guard. A
// demo visitor is allowed to send feedback (it writes nothing to the tenant
// data), so it's listed in DEMO_ALLOWED in tests/unit/demo-readonly.ts.
export async function submitFeedback(
  _prevState: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = feedbackSchema.safeParse(raw);

  if (!parsed.success) {
    return formFailure(formData, {
      error: 'Revisa los datos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  // Spam guard: both surfaces are reachable without auth. Cap per IP; fall back
  // to a shared key when no trusted IP is available (still bounds total volume).
  const ip = await getClientIpFromHeaders();
  const rate = await consumeRateLimit({
    key: `feedback:ip:${ip ?? 'unknown'}`,
    limit: 5,
    windowSeconds: 3600,
  });
  if (!rate.allowed) {
    return formFailure(formData, {
      error: 'Demasiados envíos. Intenta de nuevo más tarde.',
    });
  }

  // Context is derived server-side from the session, never trusted from the
  // client. A logged-in session (including the demo account) → App; the public
  // landing page → Demo. The user's email here is the authoritative session
  // identity, distinct from the optional follow-up email in the form.
  const session = await getSession();
  let context = 'Demo';
  if (session) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: { email: true },
    });
    context = `App (user: ${user?.email ?? 'unknown'}, clinic_id: ${session.clinicId})`;
  }

  const config = getResendConfig();
  if (!config) {
    console.error('[feedback] Resend not configured — feedback dropped');
    return formFailure(formData, {
      error: 'No pudimos enviar tu comentario en este momento. Intenta más tarde.',
    });
  }

  const result = await sendFeedbackEmail(config, {
    category: FEEDBACK_CATEGORY_LABELS[parsed.data.category],
    rating: parsed.data.rating,
    message: parsed.data.message,
    email: parsed.data.email || undefined,
    context,
  });
  if (!result.ok) {
    return formFailure(formData, {
      error: result.errorMessage ?? 'No se pudo enviar el comentario',
    });
  }

  return { success: true };
}
