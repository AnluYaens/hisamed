// Thin wrapper around the Resend SDK so the route handler stays focused on
// authorization, validation, and audit logging. Server-only — never imported
// from a Client Component. Reads RESEND_* env vars at call time so a missing
// secret surfaces as a clean disabled state instead of a startup crash.

import { Resend } from 'resend';

export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

/**
 * Reads Resend env config without throwing. Returns null when any required
 * variable is missing so callers can surface a clean "feature unavailable"
 * error instead of crashing the request.
 */
export function getResendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  const fromName = process.env.RESEND_FROM_NAME?.trim() || 'Hisamed';
  if (!apiKey || !fromEmail) return null;
  return { apiKey, fromEmail, fromName };
}

/** Where access requests from the landing page are delivered. */
export const ACCESS_REQUEST_RECIPIENT =
  process.env.ACCESS_REQUEST_EMAIL?.trim() || 'soporte@hisamed.com';

export interface AccessRequestEmailParams {
  name: string;
  email: string;
  whatsapp: string;
  clinic: string;
  specialty: string;
}

/**
 * Sends a "Solicitar acceso" request from the landing page to support.
 *
 * No DB table backs these yet — email is sufficient at the current volume.
 * If volume grows, persist them to a `waitlist` table (and keep this email as
 * a notification). Returns a discriminated result instead of throwing so the
 * Server Action can surface a clean Spanish message.
 */
export async function sendAccessRequestEmail(
  config: ResendConfig,
  params: AccessRequestEmailParams,
): Promise<SendEmailResult> {
  const client = new Resend(config.apiKey);
  const from = `${config.fromName} <${config.fromEmail}>`;

  const rows: Array<[string, string]> = [
    ['Nombre', params.name],
    ['Correo', params.email],
    ['WhatsApp', params.whatsapp],
    ['Consultorio', params.clinic],
    ['Especialidad', params.specialty],
  ];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html = `<h2>Nueva solicitud de acceso — Hisamed</h2><table cellpadding="6">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="font-weight:600">${k}</td><td>${escapeHtml(v)}</td></tr>`,
    )
    .join('')}</table>`;

  try {
    const response = await client.emails.send({
      from,
      to: ACCESS_REQUEST_RECIPIENT,
      replyTo: params.email,
      subject: `Solicitud de acceso: ${params.name} (${params.clinic})`,
      html,
      text,
    });

    if (response.error) {
      console.error('[email/resend] access request send error', {
        name: response.error.name,
        message: response.error.message,
      });
      return { ok: false, errorMessage: 'No se pudo enviar la solicitud' };
    }
    return { ok: true, id: response.data?.id };
  } catch (err) {
    console.error('[email/resend] access request threw', err instanceof Error ? err.message : err);
    return { ok: false, errorMessage: 'No se pudo enviar la solicitud' };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface SendPatientHistoryEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  pdf: Buffer;
  attachmentFilename: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** Resend message id, when send succeeded. */
  id?: string;
  /** Human-safe Spanish error message. Never includes provider internals. */
  errorMessage?: string;
}

/**
 * Sends the patient history PDF via Resend. Returns a discriminated result
 * rather than throwing so the route can audit failures uniformly.
 *
 * Errors are logged server-side with their raw shape but never returned to
 * the caller — the route surfaces a generic Spanish message to avoid leaking
 * upstream provider internals.
 */
export async function sendPatientHistoryEmail(
  config: ResendConfig,
  params: SendPatientHistoryEmailParams,
): Promise<SendEmailResult> {
  const client = new Resend(config.apiKey);
  const from = `${config.fromName} <${config.fromEmail}>`;

  try {
    const response = await client.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      attachments: [
        {
          filename: params.attachmentFilename,
          content: params.pdf,
          contentType: 'application/pdf',
        },
      ],
    });

    if (response.error) {
      console.error('[email/resend] Resend returned error', {
        name: response.error.name,
        message: response.error.message,
      });
      return { ok: false, errorMessage: 'No se pudo enviar el correo' };
    }

    return { ok: true, id: response.data?.id };
  } catch (err) {
    console.error('[email/resend] send threw', err instanceof Error ? err.message : err);
    return { ok: false, errorMessage: 'No se pudo enviar el correo' };
  }
}
