import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getPatientById } from '@/queries/patients';
import { getMedicalHistory } from '@/queries/medical-history';
import { getAppointmentsByPatient } from '@/queries/appointments';
import { getClinicalNotesByPatient } from '@/queries/clinical-notes';
import { getClinicSettings } from '@/queries/clinic';
import { PatientTabs, type PatientTabId } from '@/components/patients/patient-tabs';
import { ToggleActiveButton } from '@/components/patients/toggle-active-button';
import { MedicalHistoryForm } from '@/components/patients/medical-history-form';
import { PatientAppointments } from '@/components/appointments/patient-appointments';
import { ClinicalNoteTimeline } from '@/components/clinical-notes/clinical-note-timeline';
import { safeAuditLog, getClientIpFromHeaders } from '@/lib/audit';
import { todayInTz } from '@/lib/dates';

const CLINICAL_ROLES = new Set(['admin', 'doctor']);

interface PageProps {
  params: Promise<{ id: string }>;
}

const SEX_LABELS: Record<string, string> = { F: 'Femenino', M: 'Masculino', other: 'Otro' };

export default async function PatientDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const patient = await getPatientById(session.clinicId, id);
  if (!patient) notFound();

  // Audit READ on patient record. Use safeAuditLog so a logging failure never
  // breaks the page render; the event still gets recorded in the server log.
  await safeAuditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'READ',
    resourceType: 'patient',
    resourceId: patient.id,
    ipAddress: await getClientIpFromHeaders(),
  });

  const canViewClinical = CLINICAL_ROLES.has(session.role);
  const allowedTabs: PatientTabId[] = canViewClinical
    ? ['datos', 'citas', 'historia', 'notas', 'adjuntos']
    : ['datos', 'citas', 'adjuntos'];

  // Only fetch medical history + notes for roles that can access them. Both
  // queries re-enforce the role gate, but we still branch here to avoid
  // throwing on legitimate non-clinical viewers.
  const [medicalHistory, clinicalNotes, patientAppointments, clinicSettings] = await Promise.all([
    canViewClinical ? getMedicalHistory(patient.id) : Promise.resolve(null),
    canViewClinical
      ? getClinicalNotesByPatient(session.clinicId, patient.id)
      : Promise.resolve([]),
    getAppointmentsByPatient(session.clinicId, patient.id),
    getClinicSettings(session.clinicId),
  ]);
  const todayStr = todayInTz(clinicSettings.timezone);
  const canCreateNote = session.role === 'doctor';

  const dob = patient.dateOfBirth as string;
  const [year, month, day] = dob.split('-');

  return (
    <div className="p-6 lg:p-8">
      {/* Back link */}
      <Link
        href="/pacientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a pacientes
      </Link>

      {/* Patient header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
            {patient.firstName[0]}
            {patient.lastName[0]}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {patient.firstName} {patient.lastName}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {patient.idType === 'cedula' ? 'C.I. ' : ''}
              {patient.idNumber} · {day}/{month}/{year} · {SEX_LABELS[patient.sex] ?? patient.sex}
            </p>
            {!patient.isActive && (
              <span className="mt-1 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Inactivo
              </span>
            )}
          </div>
        </div>

        {session.role === 'admin' && (
          <ToggleActiveButton
            patientId={patient.id}
            isActive={patient.isActive}
          />
        )}
      </div>

      {/* Tabs — role gating is decided here, on the server, not in the client */}
      <PatientTabs
        patient={patient}
        allowedTabs={allowedTabs}
        todayStr={todayStr}
        citasSlot={
          <PatientAppointments
            appointments={patientAppointments}
            patientId={patient.id}
            todayStr={todayStr}
          />
        }
        historiaSlot={
          canViewClinical ? (
            <MedicalHistoryForm patientId={patient.id} history={medicalHistory} />
          ) : undefined
        }
        notasSlot={
          canViewClinical ? (
            <ClinicalNoteTimeline
              notes={clinicalNotes}
              patientId={patient.id}
              canCreate={canCreateNote}
            />
          ) : undefined
        }
      />
    </div>
  );
}
