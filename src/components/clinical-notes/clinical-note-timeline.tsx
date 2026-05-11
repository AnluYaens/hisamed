import Link from 'next/link';
import { FilePlus2, FileText, User } from 'lucide-react';
import { ClinicalNoteStatusBadge } from '@/components/clinical-notes/status-badge';
import type { ClinicalNoteListItem } from '@/queries/clinical-notes';

interface ClinicalNoteTimelineProps {
  notes: ClinicalNoteListItem[];
  patientId: string;
  /** When true, show the "Nueva nota" CTA. Decided server-side (doctor-only). */
  canCreate: boolean;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function formatMonthShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-VE', { month: 'short' }).toUpperCase();
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return String(d.getDate());
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.abs(Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

function formatElapsed(days: number): string {
  if (days === 0) return 'mismo día';
  if (days === 1) return '1 día después';
  if (days < 7) return `${days} días después`;
  const weeks = Math.round(days / 7);
  if (weeks === 1) return '1 semana después';
  if (days < 60) return `${weeks} semanas después`;
  const months = Math.round(days / 30);
  if (months === 1) return '1 mes después';
  return `${months} meses después`;
}

const VISIT_TYPE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /primera\s*vez|primera\s*consulta|nuevo\s*paciente/i, label: 'Primera vez' },
  { pattern: /urgencia|urgente|emergencia/i, label: 'Urgencia' },
  { pattern: /control|seguimiento|revisión/i, label: 'Control' },
  { pattern: /post[- ]?operatorio|post[- ]?quirúrgico/i, label: 'Postoperatorio' },
  { pattern: /parto|labor\s*de\s*parto/i, label: 'Parto' },
  { pattern: /cesárea/i, label: 'Cesárea' },
];

function inferVisitType(note: ClinicalNoteListItem): string | null {
  const text = [
    note.chiefComplaint ?? '',
    ...(note.diagnoses.map((d) => d.text)),
  ].join(' ');
  for (const { pattern, label } of VISIT_TYPE_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return 'Consulta';
}

export function ClinicalNoteTimeline({ notes, patientId, canCreate }: ClinicalNoteTimelineProps) {
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <FileText className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-600" />
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Sin notas de evolución
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Las notas clínicas del paciente aparecerán aquí.
        </p>
        {canCreate && (
          <Link
            href={`/pacientes/${patientId}/notas/nueva`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Nueva nota
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {notes.length} nota{notes.length !== 1 ? 's' : ''} en total
        </p>
        {canCreate && (
          <Link
            href={`/pacientes/${patientId}/notas/nueva`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Nueva nota
          </Link>
        )}
      </div>

      <div className="space-y-2">
        {notes.map((note, i) => (
          <TimelineRow
            key={note.id}
            note={note}
            patientId={patientId}
            prevNoteDate={notes[i + 1]?.noteDate ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineRow({
  note,
  patientId,
  prevNoteDate,
}: {
  note: ClinicalNoteListItem;
  patientId: string;
  prevNoteDate: string | null;
}) {
  const firstDiagnosis = note.diagnoses[0];
  const displayText =
    firstDiagnosis?.text ||
    note.chiefComplaint ||
    (note.isSigned ? 'Consulta sin diagnóstico registrado' : 'Borrador sin diagnóstico');

  const visitType = inferVisitType(note);
  const elapsed =
    prevNoteDate ? formatElapsed(daysBetween(prevNoteDate, note.noteDate)) : null;

  return (
    <Link
      href={`/pacientes/${patientId}/notas/${note.id}`}
      className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-blue-300 hover:bg-blue-50/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
    >
      <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-zinc-50 py-1.5 text-center dark:bg-zinc-800">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {formatMonthShort(note.noteDate)}
        </span>
        <span className="text-lg font-bold leading-tight text-zinc-900 dark:text-zinc-100">
          {formatDay(note.noteDate)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatDate(note.noteDate)}
          </span>
          <ClinicalNoteStatusBadge isSigned={note.isSigned} />
          {visitType && (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {visitType}
            </span>
          )}
          {note.diagnoses.map((d) => d.code).filter(Boolean).slice(0, 2).map((code) => (
            <span
              key={code}
              className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            >
              {code}
            </span>
          ))}
        </div>
        <p className="mt-0.5 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {displayText}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5">
            <User className="h-3 w-3 shrink-0" />
            {note.author.fullName}
          </span>
          {elapsed && (
            <span className="text-zinc-400 dark:text-zinc-500">↑ {elapsed}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
