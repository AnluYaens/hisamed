import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getPatientById } from '@/queries/patients';
import { getClinicalNotesByPatient } from '@/queries/clinical-notes';
import { ClinicalNoteTimeline } from '@/components/clinical-notes/clinical-note-timeline';

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
    <div className="p-6 lg:p-8">
      <Link
        href={`/pacientes/${patient.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la ficha
      </Link>

      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          {patient.firstName} {patient.lastName}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Notas de evolución
        </h1>
      </div>

      <ClinicalNoteTimeline notes={notes} patientId={patient.id} canCreate={canCreate} />
    </div>
  );
}
