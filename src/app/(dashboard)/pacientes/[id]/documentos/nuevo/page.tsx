import { notFound, redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { patientTrail } from '@/lib/breadcrumbs';
import { getSession } from '@/lib/auth/session';
import { getPatientById } from '@/queries/patients';
import { getMedicalHistory } from '@/queries/medical-history';
import {
  getLatestClinicalNotePrefill,
  type ClinicalNotePrefill,
} from '@/queries/clinical-notes';
import { getUserById } from '@/queries/users';
import { getClinicSettings } from '@/queries/clinic';
import { ClinicalDocumentForm } from '@/components/clinical-documents/clinical-document-form';
import { todayInTz } from '@/lib/dates';
import {
  CLINICAL_DOCUMENT_TYPES,
  type ClinicalDocumentType,
} from '@/lib/validators/clinical-document';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function isClinicalDocumentType(v: string | undefined): v is ClinicalDocumentType {
  return !!v && (CLINICAL_DOCUMENT_TYPES as readonly string[]).includes(v);
}

// Assembles plain-text prefill from a clinical note. Only includes sections
// where data is present. Never invents content.
function buildClinicalSummaryPrefill(prefill: ClinicalNotePrefill | null): string {
  if (!prefill) return '';
  const parts: string[] = [];

  if (prefill.diagnoses.length > 0) {
    const diagText = prefill.diagnoses
      .map((d) => (d.code ? `[${d.code}] ${d.text}` : d.text))
      .join(', ');
    parts.push(`Diagnósticos: ${diagText}`);
  }
  if (prefill.chiefComplaint?.trim()) {
    parts.push(`Motivo de consulta: ${prefill.chiefComplaint.trim()}`);
  }
  if (prefill.assessment?.trim()) {
    parts.push(`Evaluación: ${prefill.assessment.trim()}`);
  }
  if (prefill.plan?.trim()) {
    parts.push(`Plan: ${prefill.plan.trim()}`);
  }

  return parts.join('\n\n');
}

export default async function NewClinicalDocumentPage({ params, searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');

  // Only doctor can create. Other roles get 404 to avoid leaking the route.
  if (session.role !== 'doctor') {
    notFound();
  }

  const { id } = await params;
  const [patient, doctor, clinicSettings, search] = await Promise.all([
    getPatientById(session.clinicId, id),
    getUserById(session.clinicId, session.userId),
    getClinicSettings(session.clinicId),
    searchParams,
  ]);
  if (!patient) notFound();

  // Extract URL params before the second parallel fetch so clinicalNoteId can
  // be forwarded to the prefill query.
  const rawType = typeof search.type === 'string' ? search.type : undefined;
  const initialType = isClinicalDocumentType(rawType) ? rawType : undefined;
  const rawNote = search.clinical_note_id;
  const clinicalNoteId = typeof rawNote === 'string' ? rawNote : null;

  const todayStr = todayInTz(clinicSettings.timezone);

  const [medicalHistory, latestNotePrefill] = await Promise.all([
    getMedicalHistory(patient.id),
    getLatestClinicalNotePrefill(session.clinicId, patient.id, clinicalNoteId),
  ]);
  const allergies = medicalHistory?.allergies?.trim() || null;
  const prefillClinicalSummary = buildClinicalSummaryPrefill(latestNotePrefill);

  return (
    <div className="fade-in p-4 sm:p-8 lg:px-10">
      {allergies && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-600/20 bg-red-100/80 px-4 py-3.5 text-[13.5px] font-medium text-red-700 backdrop-blur-md">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span><strong>ALERGIAS:</strong> {allergies}</span>
        </div>
      )}
      <Breadcrumbs
        items={patientTrail(
          patient,
          { label: 'Documentos', href: `/pacientes/${patient.id}/documentos` },
          { label: 'Nuevo documento' },
        )}
      />

      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">
          {patient.firstName} {patient.lastName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-[-0.025em] text-slate-900 md:text-[28px]">
          Nuevo documento clínico
        </h1>
      </div>

      <ClinicalDocumentForm
        patient={{
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          idNumber: patient.idNumber,
          idType: patient.idType,
          dateOfBirth: patient.dateOfBirth as string,
          sex: patient.sex,
        }}
        doctorName={doctor?.fullName ?? 'Médico'}
        todayStr={todayStr}
        initialType={initialType}
        clinicalNoteId={clinicalNoteId}
        prefillCurrentMedications={medicalHistory?.currentMedications ?? null}
        prefillClinicalSummary={prefillClinicalSummary || null}
      />
    </div>
  );
}
