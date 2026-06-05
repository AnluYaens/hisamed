import { describe, expect, it, vi, beforeEach } from 'vitest';
import { feedbackSchema } from '@/lib/validators/feedback';

// ─── Validator ────────────────────────────────────────────────────────────────

describe('feedbackSchema', () => {
  const valid = {
    category: 'bug',
    rating: '4',
    message: 'La agenda se ve genial',
    email: '',
  };

  it('acepta un comentario válido (rating como string desde FormData)', () => {
    const result = feedbackSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.rating).toBe(4);
  });

  it('rechaza category, rating y message faltantes', () => {
    expect(feedbackSchema.safeParse({ ...valid, category: undefined }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...valid, rating: undefined }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...valid, message: '' }).success).toBe(false);
    // Todo faltante a la vez.
    expect(feedbackSchema.safeParse({}).success).toBe(false);
  });

  it('rechaza una categoría desconocida y un rating fuera de rango', () => {
    expect(feedbackSchema.safeParse({ ...valid, category: 'spam' }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...valid, rating: '6' }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...valid, rating: '0' }).success).toBe(false);
  });

  it('rechaza un correo de seguimiento con formato inválido pero acepta vacío', () => {
    expect(feedbackSchema.safeParse({ ...valid, email: 'no-es-correo' }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...valid, email: '' }).success).toBe(true);
    expect(feedbackSchema.safeParse({ ...valid, email: 'me@example.com' }).success).toBe(true);
  });
});

// ─── submitFeedback sends an email ────────────────────────────────────────────

const sendFeedbackEmail = vi.fn(
  async (_config: unknown, _params: Record<string, unknown>) => ({ ok: true as const, id: 'msg-1' }),
);

vi.mock('@/lib/email/resend', () => ({
  getResendConfig: () => ({ apiKey: 'test', fromEmail: 'test@example.com', fromName: 'Hisamed' }),
  sendFeedbackEmail,
}));
vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 4, retryAfterSeconds: 0 })),
}));
vi.mock('@/lib/audit', () => ({
  getClientIpFromHeaders: vi.fn(async () => '1.2.3.4'),
}));
// No session → public/landing path, so the DB user lookup is never reached.
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(async () => null),
}));
vi.mock('@/lib/db', () => ({ db: {} }));

describe('submitFeedback', () => {
  beforeEach(() => {
    sendFeedbackEmail.mockClear();
  });

  it('envía el comentario por email y reporta éxito', async () => {
    const { submitFeedback } = await import('@/actions/feedback');
    const fd = new FormData();
    fd.set('category', 'suggestion');
    fd.set('rating', '5');
    fd.set('message', 'Agreguen recordatorios por WhatsApp');
    fd.set('email', 'doc@example.com');

    const result = await submitFeedback(null, fd);

    expect(result).toEqual({ success: true });
    expect(sendFeedbackEmail).toHaveBeenCalledTimes(1);
    const params = sendFeedbackEmail.mock.calls[0][1];
    expect(params).toMatchObject({
      category: 'Sugerencia / Funcionalidad',
      rating: 5,
      message: 'Agreguen recordatorios por WhatsApp',
      email: 'doc@example.com',
      context: 'Demo',
    });
  });

  it('no envía email cuando la validación falla', async () => {
    const { submitFeedback } = await import('@/actions/feedback');
    const fd = new FormData();
    fd.set('category', 'bug');
    // rating + message faltantes
    const result = await submitFeedback(null, fd);

    expect(result).toMatchObject({ success: false });
    expect(sendFeedbackEmail).not.toHaveBeenCalled();
  });
});
