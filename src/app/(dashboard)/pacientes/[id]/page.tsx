import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getPatientById, getPatientPartner } from '@/queries/patients';
import { getMedicalHistory, getPatientAllergies } from '@/queries/medical-history';
import { getAppointmentsByPatient } from '@/queries/appointments';
import { getClinicalNotesByPatient } from '@/queries/clinical-notes';
import { getClinicSettings } from '@/queries/clinic';
import { getAttachmentsByPatient } from '@/queries/attachments';
import { getClinicalDocumentsByPatient } from '@/queries/clinical-documents';
import { PatientTabs, type PatientTabId } from '@/components/patients/patient-tabs';
import { ClinicalDocumentList } from '@/components/clinical-documents/clinical-document-list';
import { ToggleActiveButton } from '@/components/patients/toggle-active-button';
import { MedicalHistoryForm } from '@/components/patients/medical-history-form';
import { PatientAppointments } from '@/components/appointments/patient-appointments';
import { ClinicalNoteTimeline } from '@/components/clinical-notes/clinical-note-timeline';
import { AttachmentUploader } from '@/components/attachments/attachment-uploader';
import { AttachmentList } from '@/components/attachments/attachment-list';
import { PatientAvatar } from '@/components/patients/patient-avatar';
import { PatientAvatarUploader } from '@/components/patients/patient-avatar-uploader';
import { PatientAvatarRemoveButton } from '@/components/patients/patient-avatar-remove-button';
import { PartnerForm } from '@/components/patients/partner-form';
import { PartnerAvatarUploader } from '@/components/patients/partner-avatar-uploader';
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
    ? ['datos', 'pareja', 'citas', 'historia', 'notas', 'documentos', 'adjuntos']
    : ['datos', 'pareja', 'citas', 'adjuntos'];

  const [
    medicalHistory,
    clinicalNotes,
    patientAppointments,
    clinicSettings,
    patientAttachments,
    patientDocuments,
    partner,
    allergies,
  ] = await Promise.all([
    canViewClinical ? getMedicalHistory(patient.id) : Promise.resolve(null),
    canViewClinical
      ? getClinicalNotesByPatient(session.clinicId, patient.id)
      : Promise.resolve([]),
    getAppointmentsByPatient(session.clinicId, patient.id),
    getClinicSettings(session.clinicId),
    getAttachmentsByPatient(session.clinicId, patient.id),
    canViewClinical
      ? getClinicalDocumentsByPatient(session.clinicId, patient.id)
      : Promise.resolve([]),
    getPatientPartner(patient.id),
    getPatientAllergies(session.clinicId, patient.id),
  ]);

  const todayStr = todayInTz(clinicSettings.timezone);
  const canCreateNote = session.role === 'doctor';
  const canCreateDocument = session.role === 'doctor';
  const canEditPatient = true;

  const dob = patient.dateOfBirth as string;
  const [year, month, day] = dob.split('-');

  const allergiesBanner = allergies?.trim() || null;

  return (
    <div className="p-6 lg:p-8">
      {/* Allergy banner */}
      {allergiesBanner && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>ALERGIAS:</strong> {allergiesBanner}
          </span>
        </div>
      )}

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
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-1.5">
            <PatientAvatar
              patientId={patient.id}
              firstName={patient.firstName}
              lastName={patient.lastName}
              avatarStorageKey={patient.avatarStorageKey}
              className="h-20 w-20"
              textClassName="text-xl"
            />
            {canEditPatient && <PatientAvatarUploader patientId={patient.id} />}
            {canEditPatient && patient.avatarStorageKey && (
              <PatientAvatarRemoveButton patientId={patient.id} />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {patient.firstName} {patient.lastName}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {patient.idType === 'cedula' ? 'C.I. ' : ''}
              {patient.idNumber} · {day}/{month}/{year} · {SEX_LABELS[patient.sex] ?? patient.sex}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {patient.bloodType && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                  {patient.bloodType}
                </span>
              )}
              {patient.rhIncompatibility && (
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
                  ⚠️ Incompatibilidad Rh
                </span>
              )}
              {!patient.isActive && (
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  Inactivo
                </span>
              )}
            </div>
          </div>
        </div>

        {session.role === 'admin' && (
          <ToggleActiveButton
            patientId={patient.id}
            isActive={patient.isActive}
          />
        )}
      </div>

      {/* Tabs */}
      <PatientTabs
        patient={patient}
        allowedTabs={allowedTabs}
        todayStr={todayStr}
        parejaSlot={
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-4 flex items-start gap-4">
                {/* Partner avatar */}
                <div className="flex flex-col items-center gap-1.5">
                  {partner?.avatarStorageKey ? (
                    <img
                      src={`/api/patients/${patient.id}/partner/avatar?v=${partner.avatarStorageKey.split('.')[0]?.slice(0, 12)}`}
                      alt={partner.fullName}
                      className="h-16 w-16 shrink-0 rounded-full object-cover bg-purple-100 dark:bg-purple-900/50"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-purple-100 text-lg font-semibold text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                      {partner ? partner.fullName.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                  <PartnerAvatarUploader
                    patientId={patient.id}
                    hasAvatar={!!partner?.avatarStorageKey}
                  />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {partner ? partner.fullName : 'Sin datos de pareja'}
                  </h2>
                  {partner?.bloodType && (
                    <span className="mt-1 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                      {partner.bloodType}
                    </span>
                  )}
                </div>
              </div>
              <PartnerForm patientId={patient.id} partner={partner} />
            </div>
          </div>
        }
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
        documentosSlot={
          canViewClinical ? (
            <ClinicalDocumentList
              documents={patientDocuments}
              patientId={patient.id}
              canCreate={canCreateDocument}
              timeZone={clinicSettings.timezone}
            />
          ) : undefined
        }
        adjuntosSlot={
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                Subir adjunto
              </h2>
              <AttachmentUploader patientId={patient.id} />
            </div>
            <AttachmentList
              attachments={patientAttachments}
              sessionUserId={session.userId}
              sessionRole={session.role}
              timeZone={clinicSettings.timezone}
            />
          </div>
        }
      />
    </div>
  );
}
