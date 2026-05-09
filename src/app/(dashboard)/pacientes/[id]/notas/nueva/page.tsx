import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getPatientById } from '@/queries/patients';
import { getMedicalHistory } from '@/queries/medical-history';
import { getClinicSettings } from '@/queries/clinic';
import { ClinicalNoteForm } from '@/components/clinical-notes/clinical-note-form';
import { VitalSignsForm } from '@/components/vital-signs/vital-signs-form';
import { VitalSignsHistory } from '@/components/vital-signs/vital-signs-history';
import { getVitalSignsByPatient } from '@/queries/vital-signs';
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

  const [medicalHistory, vitalSignsRecords] = await Promise.all([
    getMedicalHistory(patient.id),
    getVitalSignsByPatient(session.clinicId, patient.id),
  ]);
  const allergies = medicalHistory?.allergies?.trim() || null;
  const unassignedVitalSigns = vitalSignsRecords.filter((r) => r.clinicalNoteId === null);

  const todayStr = todayInTz(clinicSettings.timezone);

  // Optional ?appointment_id= from the agenda, so "documentar consulta"
  // deep-links directly into a pre-associated note.
  const rawAppt = search.appointment_id;
  const appointmentId = typeof rawAppt === 'string' ? rawAppt : null;

  return (
    <div className="p-6 lg:p-8">
      {allergies && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span><strong>ALERGIAS:</strong> {allergies}</span>
        </div>
      )}
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

      {/* Vital signs go above the SOAP form because they're captured at the
          start of the consultation. The note has no id yet — the doctor saves
          them unassigned and associates after creating the note. */}
      <div className="mb-6 space-y-4">
        <VitalSignsForm patientId={patient.id} clinicalNoteId={null} compact />
        {unassignedVitalSigns.length > 0 && (
          <>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
              <p className="font-medium">
                Hay {unassignedVitalSigns.length === 1 ? 'un registro' : `${unassignedVitalSigns.length} registros`} de signos vitales sin nota asociada
              </p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                Guarda el borrador para habilitar el botón &ldquo;Asociar a esta nota&rdquo;.
              </p>
            </div>
            {/* attachToNoteId={null} keeps the button visible but disabled until
                the doctor saves the draft and is redirected to the edit page. */}
            <VitalSignsHistory
              records={unassignedVitalSigns}
              timeZone={clinicSettings.timezone}
              attachToNoteId={null}
            />
          </>
        )}
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
