'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { clinicalDocuments, clinicalNotes, patients } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/session';
import { isDemoSession, demoWriteBlocked } from '@/lib/auth/demo';
import { auditLog, getClientIpFromHeaders } from '@/lib/audit';
import { generateId } from '@/lib/utils/generate-id';
import {
  CLINICAL_DOCUMENT_TYPE_LABELS,
  CLINICAL_DOCUMENT_TYPES,
  clinicalDocumentCreateSchema,
  type ClinicalDocumentType,
} from '@/lib/validators/clinical-document';

export type ClinicalDocumentActionState =
  | null
  | { success: true; documentId: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isClinicalDocumentType(v: unknown): v is ClinicalDocumentType {
  return typeof v === 'string' && (CLINICAL_DOCUMENT_TYPES as readonly string[]).includes(v);
}

// Add `days` calendar days to a YYYY-MM-DD string, returning YYYY-MM-DD. The
// result is computed in UTC to avoid TZ skew (calendar arithmetic only — no
// time-of-day component is involved).
function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// ─── createClinicalDocument ───────────────────────────────────────────────────
//
// Permissions: doctor only. The form posts a `payload` field with the full
// JSON-serialized object so we don't have to reconstruct dynamic structures
// (e.g. variable-length `medications` arrays for prescriptions) field-by-field
// from FormData.

export async function createClinicalDocument(
  _prevState: ClinicalDocumentActionState,
  formData: FormData,
): Promise<ClinicalDocumentActionState> {
  let session;
  try {
    session = await requireRole(['doctor']);
  } catch {
    return {
      success: false,
      error: 'Solo los médicos pueden generar documentos clínicos',
    };
  }

  if (isDemoSession(session)) return demoWriteBlocked();

  const patientId = formData.get('patient_id');
  if (typeof patientId !== 'string' || patientId.length === 0) {
    return { success: false, error: 'Paciente no especificado' };
  }

  const rawPayload = formData.get('payload');
  if (typeof rawPayload !== 'string' || rawPayload.length === 0) {
    return { success: false, error: 'Datos del documento ausentes' };
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(rawPayload);
  } catch {
    return { success: false, error: 'Datos del documento con formato inválido' };
  }

  // Pre-check the discriminator separately to give a clear error before Zod's
  // discriminated union message ("invalid_union_discriminator") leaks out.
  const docType = (parsedPayload as { document_type?: unknown }).document_type;
  if (!isClinicalDocumentType(docType)) {
    return { success: false, error: 'Tipo de documento inválido' };
  }

  // For medical_rest, recompute end_date from start_date + rest_days so the
  // record is internally consistent regardless of what the client submitted.
  if (
    docType === 'medical_rest' &&
    parsedPayload &&
    typeof parsedPayload === 'object' &&
    'content' in parsedPayload &&
    parsedPayload.content &&
    typeof parsedPayload.content === 'object'
  ) {
    const c = parsedPayload.content as {
      start_date?: unknown;
      rest_days?: unknown;
      end_date?: unknown;
    };
    if (
      typeof c.start_date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(c.start_date) &&
      (typeof c.rest_days === 'number' || typeof c.rest_days === 'string')
    ) {
      const days = Number(c.rest_days);
      if (Number.isFinite(days) && days >= 1) {
        // Inclusive: 1 día de reposo => start_date == end_date.
        c.end_date = addDaysToDateStr(c.start_date, Math.floor(days) - 1);
      }
    }
  }

  const parsed = clinicalDocumentCreateSchema.safeParse(parsedPayload);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      success: false,
      error: 'Revisa los datos del formulario',
      // Flatten nested content fields into dot-paths so the form can map
      // them back to inputs (e.g. "content.diagnosis").
      fieldErrors: collectFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;

  // Clinic-scoped patient check — prevents tampering with hidden patient_id.
  const patientRow = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.clinicId, session.clinicId)))
    .limit(1);
  if (patientRow.length === 0) {
    return { success: false, error: 'Paciente no encontrado' };
  }

  // Optional clinical_note_id must belong to the same patient + clinic.
  if (data.clinical_note_id) {
    const noteRow = await db
      .select({ id: clinicalNotes.id })
      .from(clinicalNotes)
      .innerJoin(patients, eq(clinicalNotes.patientId, patients.id))
      .where(
        and(
          eq(clinicalNotes.id, data.clinical_note_id),
          eq(patients.clinicId, session.clinicId),
          eq(clinicalNotes.patientId, patientId),
        ),
      )
      .limit(1);
    if (noteRow.length === 0) {
      return {
        success: false,
        error: 'La consulta asociada no existe o no corresponde al paciente',
      };
    }
  }

  const documentId = generateId();
  const finalTitle =
    data.title.trim().length > 0
      ? data.title.trim()
      : CLINICAL_DOCUMENT_TYPE_LABELS[data.document_type];

  await db.insert(clinicalDocuments).values({
    id: documentId,
    clinicId: session.clinicId,
    patientId,
    clinicalNoteId: data.clinical_note_id ?? null,
    authorId: session.userId,
    documentType: data.document_type,
    title: finalTitle,
    content: data.content as Record<string, unknown>,
  });

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'CREATE',
    resourceType: 'clinical_document',
    resourceId: documentId,
    details: {
      patientId,
      documentType: data.document_type,
      clinicalNoteId: data.clinical_note_id ?? null,
    },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath(`/pacientes/${patientId}/documentos`);
  redirect(`/pacientes/${patientId}/documentos/${documentId}/print`);
}

// Walks Zod's issue list and produces a flat { "content.diagnosis": [...] } map
// so the form can show messages on the right inputs without hand-rolled
// per-type wiring.
function collectFieldErrors(error: import('zod').ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map((p) => String(p)).join('.');
    if (!out[key]) out[key] = [];
    out[key].push(issue.message);
  }
  return out;
}
