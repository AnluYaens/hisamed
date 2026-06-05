import { z } from 'zod';

// Validation for the in-app + landing-page feedback form. Both surfaces post
// to the same Server Action (src/actions/feedback.ts) which emails the message
// to support. Mirrors the access-request validator: deliberately small, no DB
// table backs it — see sendFeedbackEmail for the rationale.

/** Canonical category keys. The client renders localized labels; the email
 *  body and subject use FEEDBACK_CATEGORY_LABELS below. */
export const FEEDBACK_CATEGORIES = ['bug', 'suggestion', 'general'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

/** Human labels used in the support email (recipient is Spanish-speaking). */
export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Error / Bug',
  suggestion: 'Sugerencia / Funcionalidad',
  general: 'Comentario general',
};

export const FEEDBACK_MESSAGE_MAX = 2000;

export const feedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES, { message: 'Selecciona una categoría' }),
  // Emoji 1–5 scale. FormData delivers strings, so coerce before validating.
  rating: z.coerce
    .number({ message: 'Selecciona una valoración' })
    .int()
    .min(1, 'Selecciona una valoración')
    .max(5, 'Selecciona una valoración'),
  message: z
    .string()
    .trim()
    .min(1, 'Escribe un mensaje')
    .max(FEEDBACK_MESSAGE_MAX, `Máximo ${FEEDBACK_MESSAGE_MAX} caracteres`),
  // Optional follow-up address. The field is always present in FormData (as an
  // empty string when blank), so accept '' explicitly alongside a valid email.
  email: z
    .union([
      z.literal(''),
      z.string().trim().toLowerCase().email('Correo inválido').max(254),
    ])
    .optional(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
