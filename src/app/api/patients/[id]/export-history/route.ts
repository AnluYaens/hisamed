import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { auditLog, safeAuditLog, getClientIpFromHeaders } from '@/lib/audit';
import { enforceRateLimits } from '@/lib/rate-limit';
import { getFullClinic } from '@/queries/clinic';
import { getPatientHistoryForExport } from '@/queries/export-history';
import { buildPatientHistoryPdf, exportHistoryFilename } from '@/lib/pdf/patient-history';

// PDF generation reads pdfkit's AFM font files from disk, so this handler
// has to run on the Node.js runtime — the Edge runtime cannot serve it.
export const runtime = 'nodejs';
// The PDF is generated fresh on every request from current clinical data;
// the platform must never cache the response between users.
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set(['admin', 'doctor'] as const);

// Match the UUID-ish shape used by the avatar route. Cheap pre-flight guard
// that prevents the query layer from ever seeing obviously bogus ids.
const ID_PATTERN = /^[0-9a-f-]{20,}$/i;

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  if (!ALLOWED_ROLES.has(session.role as 'admin' | 'doctor')) {
    return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
  }

  // Rate limit BEFORE generating the PDF: 10 exports/hour per patient and
  // 30/hour per user. Keys carry only ids — never PHI or file content.
  const rate = await enforceRateLimits([
    {
      key: `export-history:user-patient:${session.userId}:${id}`,
      limit: 10,
      windowSeconds: 3600,
    },
    { key: `export-history:user:${session.userId}`, limit: 30, windowSeconds: 3600 },
  ]);
  if (!rate.allowed) {
    // Best-effort audit row: a denied export is still a meaningful event,
    // but losing this log must not turn a 429 into a 500.
    await safeAuditLog({
      clinicId: session.clinicId,
      userId: session.userId,
      action: 'EXPORT',
      resourceType: 'patient_history',
      resourceId: id,
      details: { format: 'pdf', status: 'rate_limited' },
      ipAddress: await getClientIpFromHeaders(),
    });
    return NextResponse.json(
      { success: false, error: 'Has alcanzado el límite de solicitudes. Intenta nuevamente más tarde.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    );
  }

  const clinic = await getFullClinic(session.clinicId);
  if (!clinic) {
    // A session pointing at a deleted clinic shouldn't happen, but if it does
    // we refuse rather than fall back to a default and ship a misleading PDF.
    return NextResponse.json({ success: false, error: 'Clínica no encontrada' }, { status: 404 });
  }

  const payload = await getPatientHistoryForExport(clinic, id);
  // A cross-clinic id surfaces here as null — same 404 as a non-existent
  // patient so the response never confirms the patient exists elsewhere.
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Paciente no encontrado' }, { status: 404 });
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await buildPatientHistoryPdf(payload);
  } catch (err) {
    console.error('[export-history] PDF generation failed', err);
    return NextResponse.json(
      { success: false, error: 'No se pudo generar la historia clínica' },
      { status: 500 },
    );
  }

  // Audit the export. We deliberately await (not safeAuditLog) because losing
  // the audit record for a clinical-data export is unacceptable; a DB outage
  // here surfaces as a 500 rather than a silent gap in the trail.
  try {
    await auditLog({
      clinicId: session.clinicId,
      userId: session.userId,
      action: 'EXPORT',
      resourceType: 'patient_history',
      resourceId: payload.patient.id,
      details: {
        format: 'pdf',
        notesCount: payload.notes.length,
        documentsCount: payload.documents.length,
        attachmentsCount: payload.attachments.length,
        bytes: pdfBuffer.length,
      },
      ipAddress: await getClientIpFromHeaders(),
    });
  } catch (err) {
    console.error('[export-history] failed to record audit log', err);
    return NextResponse.json(
      { success: false, error: 'No se pudo registrar la auditoría de exportación' },
      { status: 500 },
    );
  }

  const filename = exportHistoryFilename(payload.patient);
  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    // Sensitive clinical data: never cache anywhere along the chain.
    'Cache-Control': 'private, no-store',
    'Content-Length': String(pdfBuffer.length),
  });

  return new Response(new Uint8Array(pdfBuffer), { status: 200, headers });
}
