import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { auditLog, safeAuditLog, getClientIpFromHeaders } from '@/lib/audit';
import { enforceRateLimits } from '@/lib/rate-limit';
import { getFullClinic } from '@/queries/clinic';
import { getPatientHistoryForExport } from '@/queries/export-history';
import { buildPatientHistoryPdf, exportHistoryFilename } from '@/lib/pdf/patient-history';
import { getResendConfig, sendPatientHistoryEmail } from '@/lib/email/resend';
import { buildPatientHistoryEmail } from '@/lib/email/patient-history-email';

// PDF generation reads pdfkit AFM font files from disk and the Resend SDK
// uses Node-only APIs, so this handler is Node-runtime only.
export const runtime = 'nodejs';
// Per-request work — never cacheable, since the payload is patient PHI.
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set(['admin', 'doctor'] as const);

const ID_PATTERN = /^[0-9a-f-]{20,}$/i;

const bodySchema = z.object({
  recipient_email: z.string().trim().toLowerCase().email({ message: 'Correo inválido' }).max(254),
  confirmed_patient_authorization: z.literal(true, {
    message: 'Debe confirmar la autorización del paciente',
  }),
});

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return jsonNoStore({ success: false, error: 'No autenticado' }, 401);
  }

  if (!ALLOWED_ROLES.has(session.role as 'admin' | 'doctor')) {
    return jsonNoStore({ success: false, error: 'Sin permisos' }, 403);
  }

  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) {
    return jsonNoStore({ success: false, error: 'ID inválido' }, 400);
  }

  // Rate limit BEFORE building the PDF or calling Resend: 5 sends/hour per
  // patient and 15/hour per user. Keys carry only ids — the recipient email
  // is never part of a key, so no recipient address is hashed or stored here.
  const rate = await enforceRateLimits([
    {
      key: `email-history:user-patient:${session.userId}:${id}`,
      limit: 5,
      windowSeconds: 3600,
    },
    { key: `email-history:user:${session.userId}`, limit: 15, windowSeconds: 3600 },
  ]);
  if (!rate.allowed) {
    // No send was attempted, so we do NOT write an EMAIL_EXPORT
    // attempted/sent row. A distinct status='rate_limited' row keeps the
    // trail honest. Best-effort: a 429 must not become a 500.
    await safeAuditLog({
      clinicId: session.clinicId,
      userId: session.userId,
      action: 'EMAIL_EXPORT',
      resourceType: 'patient_history',
      resourceId: id,
      details: { format: 'pdf', delivery_provider: 'resend', status: 'rate_limited' },
      ipAddress: await getClientIpFromHeaders(),
    });
    return jsonNoStore(
      {
        success: false,
        error: 'Has alcanzado el límite de envíos. Intenta nuevamente más tarde.',
      },
      429,
      { 'Retry-After': String(rate.retryAfterSeconds) },
    );
  }

  // Reject obviously malformed payloads before touching the DB. We do NOT
  // log the parsed body — recipient email is mildly sensitive and the
  // confirmation flag has no diagnostic value worth retaining in logs.
  let parsedBody: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json();
    const result = bodySchema.safeParse(raw);
    if (!result.success) {
      const first = result.error.issues[0];
      return jsonNoStore(
        { success: false, error: first?.message ?? 'Datos inválidos' },
        400,
      );
    }
    parsedBody = result.data;
  } catch {
    return jsonNoStore({ success: false, error: 'Cuerpo JSON inválido' }, 400);
  }

  // Resend config is read once per request so the route stays resilient
  // when secrets are missing in dev/CI — no crash, just a clean 503.
  const resendConfig = getResendConfig();
  if (!resendConfig) {
    return jsonNoStore(
      {
        success: false,
        error: 'El envío por correo no está configurado en este servidor',
      },
      503,
    );
  }

  const clinic = await getFullClinic(session.clinicId);
  if (!clinic) {
    return jsonNoStore({ success: false, error: 'Consultorio no encontrado' }, 404);
  }

  const payload = await getPatientHistoryForExport(clinic, id);
  // Cross-clinic ids return null here — same 404 as a non-existent patient
  // so the response never confirms the patient exists in another clinic.
  if (!payload) {
    return jsonNoStore({ success: false, error: 'Paciente no encontrado' }, 404);
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await buildPatientHistoryPdf(payload);
  } catch (err) {
    console.error('[email-history] PDF generation failed', err);
    return jsonNoStore(
      { success: false, error: 'No se pudo generar la historia clínica' },
      500,
    );
  }

  const content = buildPatientHistoryEmail({
    patientFirstName: payload.patient.firstName,
    patientLastName: payload.patient.lastName,
    clinicName: clinic.name,
  });
  const attachmentFilename = exportHistoryFilename(payload.patient);

  // Read the client IP once and reuse for every audit row in this request
  // so attempted/sent/failed entries are consistent.
  const ipAddress = await getClientIpFromHeaders();

  // Shared details object — every audit row for this request carries the
  // same identifying fields, with `status` overridden per row.
  const baseDetails: Record<string, unknown> = {
    format: 'pdf',
    delivery_provider: 'resend',
    recipient_email: parsedBody.recipient_email,
    patient_id: payload.patient.id,
    pdf_byte_size: pdfBuffer.length,
    notes_count: payload.notes.length,
    documents_count: payload.documents.length,
    attachments_count: payload.attachments.length,
  };

  // 1) Pre-send "attempted" audit row. If this insert fails we MUST NOT
  // call Resend — sending without a trail is unacceptable for clinical
  // history exports. Awaiting (not safeAuditLog) means a DB outage stops
  // the send entirely rather than leaving a sent-without-trail state.
  try {
    await auditLog({
      clinicId: session.clinicId,
      userId: session.userId,
      action: 'EMAIL_EXPORT',
      resourceType: 'patient_history',
      resourceId: payload.patient.id,
      details: { ...baseDetails, status: 'attempted' },
      ipAddress,
    });
  } catch (err) {
    console.error('[email-history] pre-send audit insert failed; NOT sending', err);
    return jsonNoStore(
      {
        success: false,
        error: 'No se pudo registrar la auditoría previa al envío. No se envió el correo.',
      },
      500,
    );
  }

  // 2) Send the email. From this point on, audit failures cannot rollback
  // the send — but the attempted row above guarantees a non-empty trail.
  const sendResult = await sendPatientHistoryEmail(resendConfig, {
    to: parsedBody.recipient_email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    pdf: pdfBuffer,
    attachmentFilename,
  });

  if (!sendResult.ok) {
    // 3a) Resend failed. Record a "failed" row so the trail shows the
    // outcome alongside the earlier "attempted" row. Best-effort: we
    // already know the send didn't go out, so the user-facing 502 is the
    // authoritative result even if this row fails to persist.
    try {
      await auditLog({
        clinicId: session.clinicId,
        userId: session.userId,
        action: 'EMAIL_EXPORT',
        resourceType: 'patient_history',
        resourceId: payload.patient.id,
        details: { ...baseDetails, status: 'failed' },
        ipAddress,
      });
    } catch (auditErr) {
      console.error('[email-history] failed-send audit insert failed', auditErr);
    }

    return jsonNoStore(
      { success: false, error: sendResult.errorMessage ?? 'No se pudo enviar el correo' },
      502,
    );
  }

  // 3b) Resend succeeded — record a "sent" row carrying the provider
  // message id. If this insert fails, the "attempted" row from step 1 is
  // still in the trail, so an auditor can see what happened. We surface a
  // clear Spanish error to the operator so they can reconcile manually.
  try {
    await auditLog({
      clinicId: session.clinicId,
      userId: session.userId,
      action: 'EMAIL_EXPORT',
      resourceType: 'patient_history',
      resourceId: payload.patient.id,
      details: {
        ...baseDetails,
        status: 'sent',
        resend_message_id: sendResult.id ?? null,
      },
      ipAddress,
    });
  } catch (err) {
    console.error('[email-history] success audit insert failed AFTER send', err);
    return jsonNoStore(
      {
        success: false,
        error:
          'El correo fue enviado, pero no se pudo registrar la auditoría de éxito. Notifique al administrador.',
      },
      500,
    );
  }

  return jsonNoStore({ success: true }, 200);
}

function jsonNoStore(
  body: Record<string, unknown>,
  status: number,
  extraHeaders?: Record<string, string>,
) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', ...extraHeaders },
  });
}
