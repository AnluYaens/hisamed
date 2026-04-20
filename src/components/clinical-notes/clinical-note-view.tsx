import { CalendarDays, Lock, ShieldAlert, User } from 'lucide-react';
import { ClinicalNoteStatusBadge } from '@/components/clinical-notes/status-badge';
import type { ClinicalNoteDetail } from '@/queries/clinical-notes';

interface ClinicalNoteViewProps {
  note: ClinicalNoteDetail;
  /**
   * True when the *current viewer* may see internal_notes. The value itself
   * is also nulled in the query for non-doctor roles, so this prop is just
   * for deciding whether to render the (empty) section at all.
   */
  canViewInternalNotes: boolean;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function formatDateTime(d: Date): string {
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        'rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900',
        className ?? '',
      ].join(' ')}
    >
      <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TextBlock({ value, placeholder }: { value: string | null; placeholder?: string }) {
  if (!value) {
    return (
      <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
        {placeholder ?? 'Sin información registrada.'}
      </p>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">{value}</p>
  );
}

function SpecialtyRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
}) {
  const display =
    value === null || value === undefined || value === ''
      ? null
      : `${value}${unit ? ` ${unit}` : ''}`;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {display ?? <span className="italic text-zinc-400 dark:text-zinc-500">—</span>}
      </span>
    </div>
  );
}

export function ClinicalNoteView({ note, canViewInternalNotes }: ClinicalNoteViewProps) {
  const sp = note.specialtyData;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Nota de evolución
              </h1>
              <ClinicalNoteStatusBadge isSigned={note.isSigned} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(note.noteDate)}
              </span>
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {note.author.fullName}
              </span>
              {note.isSigned && note.signedAt && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Lock className="h-3.5 w-3.5" />
                  Firmada el {formatDateTime(note.signedAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        {note.chiefComplaint && (
          <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              Motivo de consulta:{' '}
            </span>
            {note.chiefComplaint}
          </p>
        )}
      </div>

      {/* SOAP */}
      <SectionCard title="Subjetivo">
        <TextBlock value={note.subjective} />
      </SectionCard>
      <SectionCard title="Objetivo">
        <TextBlock value={note.objective} />
      </SectionCard>
      <SectionCard title="Análisis / Evaluación">
        <TextBlock value={note.assessment} />
      </SectionCard>
      <SectionCard title="Plan">
        <TextBlock value={note.plan} />
      </SectionCard>

      {/* Diagnóstico */}
      {(note.diagnosisText || note.diagnosisCode) && (
        <SectionCard title="Diagnóstico">
          <div className="flex flex-wrap items-center gap-3">
            {note.diagnosisText && (
              <p className="text-sm text-zinc-800 dark:text-zinc-200">{note.diagnosisText}</p>
            )}
            {note.diagnosisCode && (
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {note.diagnosisCode}
              </span>
            )}
          </div>
        </SectionCard>
      )}

      {/* specialty_data */}
      {sp && Object.values(sp).some((v) => v !== null && v !== undefined && v !== '') && (
        <SectionCard title="Datos de consulta ginecológica">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <SpecialtyRow label="TA" value={sp.blood_pressure ?? null} unit="mmHg" />
            <SpecialtyRow label="Peso" value={sp.weight_kg ?? null} unit="kg" />
            <SpecialtyRow label="Talla" value={sp.height_cm ?? null} unit="cm" />
            <SpecialtyRow label="IMC" value={sp.bmi ?? null} />
            <SpecialtyRow
              label="FUM"
              value={sp.last_menstrual_period ? formatDate(sp.last_menstrual_period) : null}
            />
            <SpecialtyRow
              label="Edad gestacional"
              value={sp.gestational_age_weeks ?? null}
              unit="sem"
            />
            <SpecialtyRow label="Folículos izquierdo" value={sp.follicle_count_left ?? null} />
            <SpecialtyRow label="Folículos derecho" value={sp.follicle_count_right ?? null} />
            <SpecialtyRow
              label="Grosor endometrial"
              value={sp.endometrial_thickness_mm ?? null}
              unit="mm"
            />
          </div>

          {sp.ultrasound_findings && (
            <div className="mt-5">
              <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                Hallazgos ecográficos
              </p>
              <TextBlock value={sp.ultrasound_findings ?? null} />
            </div>
          )}
          {sp.procedure_performed && (
            <div className="mt-5">
              <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                Procedimiento realizado
              </p>
              <TextBlock value={sp.procedure_performed ?? null} />
            </div>
          )}
          {sp.treatment_protocol && (
            <div className="mt-5">
              <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                Protocolo de tratamiento
              </p>
              <TextBlock value={sp.treatment_protocol ?? null} />
            </div>
          )}
        </SectionCard>
      )}

      {/* Internal notes — only rendered when the viewer is a doctor. The
          value itself is already NULLed in the query for any other role,
          but we also skip the whole section for clarity. */}
      {canViewInternalNotes && note.internalNotes && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900/40 dark:bg-amber-950/10">
          <div className="mb-3 flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Notas internas (solo visibles para médicos)
            </h2>
          </div>
          <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
            {note.internalNotes}
          </p>
        </section>
      )}
    </div>
  );
}
