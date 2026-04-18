import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getPatientById } from '@/queries/patients';
import { getMedicalHistory } from '@/queries/medical-history';
import { PatientTabs, type PatientTabId } from '@/components/patients/patient-tabs';
import { ToggleActiveButton } from '@/components/patients/toggle-active-button';
import { MedicalHistoryForm } from '@/components/patients/medical-history-form';
import { safeAuditLog, getClientIpFromHeaders } from '@/lib/audit';

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

  // Only fetch medical history for roles that can access it. The query itself
  // re-enforces the role gate, but we still branch here to avoid throwing on
  // legitimate non-clinical viewers.
  const medicalHistory = canViewClinical
    ? await getMedicalHistory(patient.id)
    : null;

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
        historiaSlot={
          canViewClinical ? (
            <MedicalHistoryForm patientId={patient.id} history={medicalHistory} />
          ) : undefined
        }
        notasSlot={
          canViewClinical ? (
            <ClinicalPlaceholder
              title="Notas de evolución"
              description="Las notas SOAP del paciente aparecerán aquí una vez que se implemente el módulo de notas clínicas."
            />
          ) : undefined
        }
      />
    </div>
  );
}

function ClinicalPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-zinc-400 dark:text-zinc-500">{description}</p>
    </div>
  );
}
