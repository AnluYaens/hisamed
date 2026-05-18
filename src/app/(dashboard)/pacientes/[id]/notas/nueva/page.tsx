import { notFound, redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { patientTrail } from '@/lib/breadcrumbs';
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
    <div className="fade-in p-6 sm:p-8 lg:px-10">
      {allergies && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-600/20 bg-red-100/80 px-4 py-3.5 text-[13.5px] font-medium text-red-700 backdrop-blur-md">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <span>
            <strong className="font-bold uppercase tracking-wide">Alergias:</strong> {allergies}
          </span>
        </div>
      )}
      <Breadcrumbs
        items={patientTrail(
          patient,
          { label: 'Notas', href: `/pacientes/${patient.id}/notas` },
          { label: 'Nueva nota' },
        )}
      />

      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">
          {patient.firstName} {patient.lastName}
        </p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.025em] text-slate-900">
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
            <div className="rounded-2xl border border-blue-600/20 bg-blue-100/70 px-4 py-3 text-sm text-blue-900 backdrop-blur-md">
              <p className="font-medium">
                Hay {unassignedVitalSigns.length === 1 ? 'un registro' : `${unassignedVitalSigns.length} registros`} de signos vitales sin nota asociada
              </p>
              <p className="mt-1 text-xs text-blue-700">
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
