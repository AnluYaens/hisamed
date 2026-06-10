import { notFound, redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { patientTrail } from '@/lib/breadcrumbs';
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
import { ExportHistoryButton } from '@/components/patients/export-history-button';
import { EmailHistoryButton } from '@/components/patients/email-history-button';
import { MedicalHistoryForm } from '@/components/patients/medical-history-form';
import { PatientAppointments } from '@/components/appointments/patient-appointments';
import { ClinicalNoteTimeline } from '@/components/clinical-notes/clinical-note-timeline';
import { VitalSignsForm } from '@/components/vital-signs/vital-signs-form';
import { VitalSignsHistory } from '@/components/vital-signs/vital-signs-history';
import { getVitalSignsByPatient } from '@/queries/vital-signs';
import { AttachmentUploader } from '@/components/attachments/attachment-uploader';
import { AttachmentList } from '@/components/attachments/attachment-list';
import { PatientAvatar } from '@/components/patients/patient-avatar';
import { PatientAvatarUploader } from '@/components/patients/patient-avatar-uploader';
import { PatientAvatarRemoveButton } from '@/components/patients/patient-avatar-remove-button';
import { PartnerForm } from '@/components/patients/partner-form';
import { PartnerAvatarUploader } from '@/components/patients/partner-avatar-uploader';
import { safeAuditLog, getClientIpFromHeaders } from '@/lib/audit';
import { todayInTz } from '@/lib/dates';
import { calcGestationalAge, getGestationalTrimester, TRIMESTER_LABELS } from '@/lib/obstetric';
import type { GynecologyData } from '@/lib/validators/medical-history';

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
  // Vital signs are visible to every clinic role (incl. receptionist) because
  // the assistant who took the measurements needs to confirm them.
  const allowedTabs: PatientTabId[] = canViewClinical
    ? ['datos', 'pareja', 'citas', 'historia', 'signos', 'notas', 'documentos', 'adjuntos']
    : ['datos', 'pareja', 'citas', 'signos', 'adjuntos'];

  const [
    medicalHistory,
    clinicalNotes,
    patientAppointments,
    clinicSettings,
    patientAttachments,
    patientDocuments,
    partner,
    allergies,
    vitalSignsRecords,
  ] = await Promise.all([
    canViewClinical ? getMedicalHistory(patient.id) : Promise.resolve(null),
    canViewClinical
      ? getClinicalNotesByPatient(session.clinicId, patient.id)
      : Promise.resolve([]),
    getAppointmentsByPatient(session.clinicId, patient.id),
    getClinicSettings(session.clinicId),
    getAttachmentsByPatient(session.clinicId, patient.id, {
      includeClinicalAttachments: canViewClinical,
    }),
    canViewClinical
      ? getClinicalDocumentsByPatient(session.clinicId, patient.id)
      : Promise.resolve([]),
    getPatientPartner(session.clinicId, patient.id),
    getPatientAllergies(session.clinicId, patient.id),
    getVitalSignsByPatient(session.clinicId, patient.id),
  ]);

  const todayStr = todayInTz(clinicSettings.timezone);
  const canCreateNote = session.role === 'doctor';
  const canCreateDocument = session.role === 'doctor';
  const canEditPatient = true;

  // ── Obstetric badge ────────────────────────────────────────────────────────
  // Only for female patients with clinical access.
  let activePregnancy: { weeks: number; days: number; trimester: 1 | 2 | 3 } | null = null;
  let staleFUM = false;
  if (canViewClinical && patient.sex === 'F' && medicalHistory?.specialtyData) {
    const gynData = medicalHistory.specialtyData as GynecologyData;
    if (gynData.last_menstrual_period && !gynData.pregnancy_ended) {
      const ga = calcGestationalAge(gynData.last_menstrual_period, todayStr);
      if (ga.weeks < 42) {
        activePregnancy = { ...ga, trimester: getGestationalTrimester(ga.weeks) };
      } else {
        staleFUM = true;
      }
    }
  }

  // ── Última visita / Próxima cita ──────────────────────────────────────────
  const lastNote = clinicalNotes.length > 0 ? clinicalNotes[0] : null;
  const nextAppointment = patientAppointments
    .filter(
      (a) =>
        a.date >= todayStr &&
        a.status !== 'cancelled' &&
        a.status !== 'no_show',
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;

  function daysBetween(dateA: string, dateB: string): number {
    const a = new Date(dateA + 'T00:00:00');
    const b = new Date(dateB + 'T00:00:00');
    return Math.round((b.getTime() - a.getTime()) / 86_400_000);
  }

  function formatDateEs(dateStr: string) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  let lastVisitLabel: string | null = null;
  if (lastNote) {
    const diff = daysBetween(lastNote.noteDate, todayStr);
    if (diff === 0) lastVisitLabel = `Última consulta: hoy (${formatDateEs(lastNote.noteDate)})`;
    else if (diff === 1) lastVisitLabel = `Última consulta: ayer (${formatDateEs(lastNote.noteDate)})`;
    else lastVisitLabel = `Última consulta: hace ${diff} día${diff !== 1 ? 's' : ''} (${formatDateEs(lastNote.noteDate)})`;
  }

  let nextApptLabel: string | null = null;
  if (nextAppointment) {
    const diff = daysBetween(todayStr, nextAppointment.date);
    if (diff === 0) nextApptLabel = `Próxima cita: hoy (${formatDateEs(nextAppointment.date)})`;
    else if (diff === 1) nextApptLabel = `Próxima cita: mañana (${formatDateEs(nextAppointment.date)})`;
    else nextApptLabel = `Próxima cita: en ${diff} días (${formatDateEs(nextAppointment.date)})`;
  }

  const dob = patient.dateOfBirth as string;
  const [year, month, day] = dob.split('-');

  // Age in whole years, computed from date of birth.
  const patientAge = (() => {
    const d = new Date(dob);
    const t = new Date();
    let a = t.getFullYear() - d.getFullYear();
    const m = t.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
    return a;
  })();

  const allergiesBanner = allergies?.trim() || null;

  return (
    <div className="fade-in p-4 sm:p-8 lg:px-10">
      {/* Allergy banner — kept prominent, frosted danger alert. */}
      {allergiesBanner && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-600/20 bg-red-100/80 px-4 py-3.5 text-[13.5px] font-medium text-red-700 backdrop-blur-md">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <span>
            <strong className="font-bold uppercase tracking-wide">Alergias:</strong>{' '}
            {allergiesBanner}
          </span>
        </div>
      )}

      <Breadcrumbs items={patientTrail(patient)} />

      {/* Patient header */}
      <div className="glass-card mb-6 rounded-[22px] p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <PatientAvatar
              patientId={patient.id}
              firstName={patient.firstName}
              lastName={patient.lastName}
              avatarStorageKey={patient.avatarStorageKey}
              className="h-16 w-16 rounded-3xl shadow-[inset_0_0_0_1px_rgba(13,148,136,0.18),0_8px_20px_-8px_rgba(13,148,136,0.35)] sm:h-22 sm:w-22"
              textClassName="text-xl sm:text-2xl"
            />
            {canEditPatient && <PatientAvatarUploader patientId={patient.id} />}
            {canEditPatient && patient.avatarStorageKey && (
              <PatientAvatarRemoveButton patientId={patient.id} />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold leading-tight tracking-[-0.025em] text-slate-900 sm:text-2xl md:text-[28px]">
              {patient.firstName} {patient.lastName}
            </h1>
            <p className="mt-1 break-words text-sm text-slate-500">
              {patientAge} años · {patient.idType === 'cedula' ? 'C.I. ' : ''}
              {patient.idNumber} · {patient.phone?.trim() || 'Sin teléfono'}
            </p>
            <p className="text-xs text-slate-400">
              {day}/{month}/{year} · {SEX_LABELS[patient.sex] ?? patient.sex}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {patient.bloodType && (
                <span className="inline-flex items-center rounded-full bg-blue-600/12 px-2.5 py-0.5 text-[11.5px] font-semibold text-blue-700">
                  {patient.bloodType}
                </span>
              )}
              {patient.rhIncompatibility && (
                <span className="inline-flex items-center rounded-full bg-amber-600/14 px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-700">
                  ⚠️ Incompatibilidad Rh
                </span>
              )}
              {activePregnancy && (
                <span className="inline-flex items-center rounded-full bg-pink-700/12 px-2.5 py-0.5 text-[11.5px] font-semibold text-pink-700">
                  🤰 {activePregnancy.weeks} sem + {activePregnancy.days} día{activePregnancy.days !== 1 ? 's' : ''} · {TRIMESTER_LABELS[activePregnancy.trimester]}
                </span>
              )}
              {staleFUM && (
                <span className="inline-flex items-center rounded-full bg-amber-600/14 px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-700">
                  ⚠️ Verificar FUM / fin de embarazo
                </span>
              )}
              {!patient.isActive && (
                <span className="inline-flex items-center rounded-full bg-zinc-500/12 px-2.5 py-0.5 text-[11.5px] font-semibold text-slate-600">
                  Inactivo
                </span>
              )}
            </div>
            {(lastVisitLabel || nextApptLabel) && (
              <div className="mt-2.5 flex flex-wrap gap-3">
                {lastVisitLabel && (
                  <span className="text-xs text-slate-500">{lastVisitLabel}</span>
                )}
                {nextApptLabel && (
                  <span className="text-xs font-semibold text-teal-700">{nextApptLabel}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canViewClinical && <ExportHistoryButton patientId={patient.id} />}
          {canViewClinical && (
            <EmailHistoryButton
              patientId={patient.id}
              defaultRecipientEmail={patient.email}
            />
          )}
          {(session.role === 'admin' || session.role === 'doctor') && (
            <ToggleActiveButton
              patientId={patient.id}
              isActive={patient.isActive}
            />
          )}
        </div>
        </div>
      </div>

      {/* Tabs */}
      <PatientTabs
        patient={patient}
        allowedTabs={allowedTabs}
        todayStr={todayStr}
        parejaSlot={
          <div className="space-y-4">
            <div className="glass-card rounded-[22px] p-6">
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
        signosSlot={
          <div className="space-y-4">
            <VitalSignsForm patientId={patient.id} clinicalNoteId={null} />
            <VitalSignsHistory
              records={vitalSignsRecords}
              timeZone={clinicSettings.timezone}
            />
          </div>
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
            <div className="glass-card rounded-[22px] p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">
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
