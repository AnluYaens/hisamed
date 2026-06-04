'use server';

import { accessRequestSchema } from '@/lib/validators/access-request';
import { getResendConfig, sendAccessRequestEmail } from '@/lib/email/resend';
import { consumeRateLimit } from '@/lib/rate-limit';
import { getClientIpFromHeaders } from '@/lib/audit';
import { formFailure, type FormFailure } from '@/lib/forms/state';

export type AccessRequestState = null | { success: true } | FormFailure;

// Public Server Action backing the landing-page "Solicitar acceso" form.
// Validates with Zod (same pattern as the rest of the app), rate-limits per IP
// to blunt spam, and emails the request to support via the existing Resend
// integration. No DB table — see sendAccessRequestEmail for the rationale.
export async function submitAccessRequest(
  _prevState: AccessRequestState,
  formData: FormData,
): Promise<AccessRequestState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = accessRequestSchema.safeParse(raw);

  if (!parsed.success) {
    return formFailure(formData, {
      error: 'Revisa los datos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  // Spam guard: this endpoint is fully public. Cap per IP; fall back to a
  // shared key when no trusted IP is available (still bounds total volume).
  const ip = await getClientIpFromHeaders();
  const rate = await consumeRateLimit({
    key: `access-request:ip:${ip ?? 'unknown'}`,
    limit: 5,
    windowSeconds: 3600,
  });
  if (!rate.allowed) {
    return formFailure(formData, {
      error: 'Demasiadas solicitudes. Intenta de nuevo más tarde o escríbenos por WhatsApp.',
    });
  }

  const config = getResendConfig();
  if (!config) {
    console.error('[access-request] Resend not configured — request dropped');
    return formFailure(formData, {
      error: 'No pudimos enviar tu solicitud en este momento. Escríbenos por WhatsApp.',
    });
  }

  const result = await sendAccessRequestEmail(config, parsed.data);
  if (!result.ok) {
    return formFailure(formData, {
      error: result.errorMessage ?? 'No se pudo enviar la solicitud',
    });
  }

  return { success: true };
}
