import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getClinicalNoteById } from '@/queries/clinical-notes';
import { getClinicSettings } from '@/queries/clinic';
import { ClinicalNoteForm } from '@/components/clinical-notes/clinical-note-form';
import { ClinicalNoteView } from '@/components/clinical-notes/clinical-note-view';
import { safeAuditLog, getClientIpFromHeaders } from '@/lib/audit';
import { todayInTz } from '@/lib/dates';

const CLINICAL_ROLES = new Set(['admin', 'doctor']);

interface PageProps {
  params: Promise<{ id: string; noteId: string }>;
}

export default async function ClinicalNoteDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');

  // Receptionist: no access to clinical notes.
  if (!CLINICAL_ROLES.has(session.role)) {
    notFound();
  }

  const { id, noteId } = await params;
  const note = await getClinicalNoteById(session.clinicId, noteId);

  // Also verifies the note belongs to the URL's patient (prevents hand-crafted
  // URLs of the form /pacientes/<other>/notas/<existing>).
  if (!note || note.patientId !== id) {
    notFound();
  }

  // Audit trail: viewing a clinical note is a sensitive READ.
  await safeAuditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'READ',
    resourceType: 'clinical_note',
    resourceId: note.id,
    ipAddress: await getClientIpFromHeaders(),
  });

  // Edit mode rules (PRD §2):
  //   - doctor + author + not signed → editable form
  //   - doctor + author + signed     → read-only (immutable)
  //   - doctor + not author          → read-only
  //   - admin                        → always read-only
  const isOwnUnsignedByDoctor =
    session.role === 'doctor' && session.userId === note.authorId && !note.isSigned;

  const clinicSettings = await getClinicSettings(session.clinicId);
  const todayStr = todayInTz(clinicSettings.timezone);
  const canViewInternalNotes = session.role === 'doctor';

  return (
    <div className="p-6 lg:p-8">
      <Link
        href={`/pacientes/${id}/notas`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a notas
      </Link>

      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          {note.patient.firstName} {note.patient.lastName} · C.I. {note.patient.idNumber}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {isOwnUnsignedByDoctor ? 'Editar nota de evolución' : 'Nota de evolución'}
        </h1>
      </div>

      {isOwnUnsignedByDoctor ? (
        <ClinicalNoteForm
          patientId={note.patientId}
          note={{
            id: note.id,
            noteDate: note.noteDate,
            chiefComplaint: note.chiefComplaint,
            subjective: note.subjective,
            objective: note.objective,
            assessment: note.assessment,
            plan: note.plan,
            diagnosisText: note.diagnosisText,
            diagnosisCode: note.diagnosisCode,
            // Always safe: we only render the form when the author (doctor)
            // is the current user, and doctors are the only role allowed
            // to see internal_notes.
            internalNotes: note.internalNotes,
            specialtyData: note.specialtyData,
            isSigned: note.isSigned,
            signedAt: note.signedAt,
            updatedAt: note.updatedAt,
          }}
          todayStr={todayStr}
          appointmentId={note.appointmentId}
        />
      ) : (
        <ClinicalNoteView note={note} canViewInternalNotes={canViewInternalNotes} />
      )}
    </div>
  );
}
