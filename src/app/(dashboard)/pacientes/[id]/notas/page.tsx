import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getPatientById } from '@/queries/patients';
import { getClinicalNotesByPatient } from '@/queries/clinical-notes';
import { ClinicalNoteTimeline } from '@/components/clinical-notes/clinical-note-timeline';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { patientTrail } from '@/lib/breadcrumbs';

// PRD Técnico §2: receptionist cannot view clinical notes at all — they get
// a 404 rather than the tab. Admin + doctor can view; only doctor sees the
// "Nueva nota" CTA.
const CLINICAL_ROLES = new Set(['admin', 'doctor']);

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientNotesPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');

  if (!CLINICAL_ROLES.has(session.role)) {
    notFound();
  }

  const { id } = await params;
  const patient = await getPatientById(session.clinicId, id);
  if (!patient) notFound();

  const notes = await getClinicalNotesByPatient(session.clinicId, patient.id);
  const canCreate = session.role === 'doctor';

  return (
    <div className="fade-in p-4 sm:p-8 lg:px-10">
      <Breadcrumbs items={patientTrail(patient, { label: 'Notas' })} />

      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">
          {patient.firstName} {patient.lastName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-[-0.025em] text-slate-900 md:text-[28px]">
          Notas de evolución
        </h1>
      </div>

      <ClinicalNoteTimeline notes={notes} patientId={patient.id} canCreate={canCreate} />
    </div>
  );
}
