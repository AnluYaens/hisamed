import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { patientTrail } from '@/lib/breadcrumbs';
import { getClinicalNoteById } from '@/queries/clinical-notes';
import { getClinicSettings } from '@/queries/clinic';
import { getAttachmentsByClinicalNote } from '@/queries/attachments';
import { ClinicalNoteForm } from '@/components/clinical-notes/clinical-note-form';
import { ClinicalNoteView } from '@/components/clinical-notes/clinical-note-view';
import { VitalSignsHistory } from '@/components/vital-signs/vital-signs-history';
import { getVitalSignsByPatient } from '@/queries/vital-signs';
import { AttachmentUploader } from '@/components/attachments/attachment-uploader';
import { AttachmentList } from '@/components/attachments/attachment-list';
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

  const [clinicSettings, noteAttachments, vitalSignsRecords] = await Promise.all([
    getClinicSettings(session.clinicId),
    getAttachmentsByClinicalNote(session.clinicId, note.id),
    getVitalSignsByPatient(session.clinicId, note.patientId),
  ]);
  // Records already linked to *this* note plus any unassigned ones for the
  // patient. Other notes' vital signs stay out — they belong to that visit.
  const relevantVitalSigns = vitalSignsRecords.filter(
    (r) => r.clinicalNoteId === note.id || r.clinicalNoteId === null,
  );
  const hasUnassigned = relevantVitalSigns.some((r) => r.clinicalNoteId === null);
  const todayStr = todayInTz(clinicSettings.timezone);
  const canViewInternalNotes = session.role === 'doctor';

  return (
    <div className="fade-in p-4 sm:p-8 lg:px-10">
      <Breadcrumbs
        items={patientTrail(
          { id, firstName: note.patient.firstName, lastName: note.patient.lastName },
          { label: 'Notas', href: `/pacientes/${id}/notas` },
          { label: 'Nota clínica' },
        )}
      />

      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">
          {note.patient.firstName} {note.patient.lastName} · C.I. {note.patient.idNumber}
        </p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-[-0.025em] text-slate-900 md:text-[28px]">
          {isOwnUnsignedByDoctor ? 'Editar nota de evolución' : 'Nota de evolución'}
        </h1>
      </div>

      {/* Vital signs section — sits above the SOAP note (mirrors the new-note
          page). Only the unsigned-author doctor can attach unassigned records;
          other roles or signed notes just see the read-only history. */}
      {relevantVitalSigns.length > 0 && (
        <section className="mb-6 space-y-4">
          {isOwnUnsignedByDoctor && hasUnassigned && (
            <div className="rounded-2xl border border-blue-600/20 bg-blue-100/70 px-4 py-3 text-sm text-blue-900 backdrop-blur-md">
              Hay signos vitales del paciente sin nota asociada. Usa el botón
              &ldquo;Asociar a esta nota&rdquo; para vincularlos a esta consulta.
            </div>
          )}
          <VitalSignsHistory
            records={relevantVitalSigns}
            timeZone={clinicSettings.timezone}
            attachToNoteId={isOwnUnsignedByDoctor ? note.id : undefined}
          />
        </section>
      )}

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
            diagnoses: note.diagnoses,
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
          ultrasoundAttachments={noteAttachments
            .filter((a) => a.category === 'ultrasound')
            .map((a) => ({ id: a.id, fileName: a.fileName, fileType: a.fileType }))}
        />
      ) : (
        <ClinicalNoteView
          note={note}
          canViewInternalNotes={canViewInternalNotes}
          procedurePhotos={Object.fromEntries(
            noteAttachments
              .filter((a) => a.category === 'procedure_photo')
              .map((a) => [a.id, { id: a.id, fileName: a.fileName }]),
          )}
          ultrasoundAttachments={noteAttachments
            .filter((a) => a.category === 'ultrasound')
            .map((a) => ({ id: a.id, fileName: a.fileName, fileType: a.fileType }))}
        />
      )}

      {/* Attachments tied to this note. Doctor authoring an unsigned note can
          upload; everyone else (admin, or doctor viewing a signed/other note)
          still sees the list + download. */}
      <section className="mt-8 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">
          Adjuntos de la nota
        </h2>
        {isOwnUnsignedByDoctor && (
          <div className="glass-card rounded-[22px] p-5">
            <AttachmentUploader patientId={note.patientId} clinicalNoteId={note.id} />
          </div>
        )}
        <AttachmentList
          attachments={noteAttachments}
          sessionUserId={session.userId}
          sessionRole={session.role}
          timeZone={clinicSettings.timezone}
        />
      </section>
    </div>
  );
}
