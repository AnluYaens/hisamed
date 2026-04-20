import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getPatientById } from '@/queries/patients';
import { getClinicSettings } from '@/queries/clinic';
import { ClinicalNoteForm } from '@/components/clinical-notes/clinical-note-form';
import { todayInTz } from '@/lib/dates';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewClinicalNotePage({ params, searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');

  // PRD Técnico §2: only `doctor` can create notes. Other roles get a 404 to
  // avoid leaking the existence of this route to the UI.
  if (session.role !== 'doctor') {
    notFound();
  }

  const { id } = await params;
  const [patient, clinicSettings, search] = await Promise.all([
    getPatientById(session.clinicId, id),
    getClinicSettings(session.clinicId),
    searchParams,
  ]);
  if (!patient) notFound();

  const todayStr = todayInTz(clinicSettings.timezone);

  // Optional ?appointment_id= from the agenda, so "documentar consulta"
  // deep-links directly into a pre-associated note.
  const rawAppt = search.appointment_id;
  const appointmentId = typeof rawAppt === 'string' ? rawAppt : null;

  return (
    <div className="p-6 lg:p-8">
      <Link
        href={`/pacientes/${patient.id}/notas`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a notas
      </Link>

      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          {patient.firstName} {patient.lastName}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Nueva nota de evolución
        </h1>
      </div>

      <ClinicalNoteForm
        patientId={patient.id}
        note={null}
        todayStr={todayStr}
        appointmentId={appointmentId}
      />
    </div>
  );
}
