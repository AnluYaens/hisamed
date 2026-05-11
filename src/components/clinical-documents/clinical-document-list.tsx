import Link from 'next/link';
import {
  FilePlus2,
  FileText,
  FlaskConical,
  HeartPulse,
  Microscope,
  Pill,
  Send,
  Stamp,
  User,
} from 'lucide-react';
import type { ClinicalDocumentListItem } from '@/queries/clinical-documents';
import {
  CLINICAL_DOCUMENT_TYPE_LABELS,
  type ClinicalDocumentType,
} from '@/lib/validators/clinical-document';

interface ClinicalDocumentListProps {
  documents: ClinicalDocumentListItem[];
  patientId: string;
  /** Doctor only — controls the "Nuevo documento" CTA. */
  canCreate: boolean;
  timeZone: string;
}

const TYPE_ICONS: Record<ClinicalDocumentType, React.ComponentType<{ className?: string }>> = {
  medical_rest: HeartPulse,
  medical_certificate: Stamp,
  referral: Send,
  prescription: Pill,
  patient_instructions: FileText,
  lab_order: FlaskConical,
  imaging_order: Microscope,
  interconsultation: Send,
};

function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function ClinicalDocumentList({
  documents,
  patientId,
  canCreate,
  timeZone,
}: ClinicalDocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <FileText className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-600" />
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Sin documentos generados
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Reposos, constancias, referencias y récipes aparecerán aquí.
        </p>
        {canCreate && (
          <Link
            href={`/pacientes/${patientId}/documentos/nuevo`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Nuevo documento
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {documents.length} documento{documents.length !== 1 ? 's' : ''}
        </p>
        {canCreate && (
          <Link
            href={`/pacientes/${patientId}/documentos/nuevo`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Nuevo documento
          </Link>
        )}
      </div>

      <div className="space-y-2">
        {documents.map((doc) => {
          const Icon = TYPE_ICONS[doc.documentType] ?? FileText;
          return (
            <Link
              key={doc.id}
              href={`/pacientes/${patientId}/documentos/${doc.id}/print`}
              className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-blue-300 hover:bg-blue-50/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {CLINICAL_DOCUMENT_TYPE_LABELS[doc.documentType]}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(doc.createdAt, timeZone)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {doc.title}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <User className="h-3 w-3 shrink-0" />
                  {doc.author.fullName}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
