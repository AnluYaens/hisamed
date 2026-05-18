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
      <div className="glass-card flex flex-col items-center justify-center rounded-[22px] py-14 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#F0FDFA,#CCFBF1)] text-teal-600 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.15),0_8px_18px_-8px_rgba(13,148,136,0.35)]">
          <FileText className="h-7 w-7" />
        </span>
        <p className="mt-2 text-[15px] font-semibold text-slate-800">
          Aún no hay consultas registradas
        </p>
        <p className="mt-1 max-w-80 text-[13px] leading-relaxed text-slate-500">
          Crea una nota clínica para documentar la primera consulta del paciente.
        </p>
        {canCreate && (
          <Link
            href={`/pacientes/${patientId}/notas/nueva`}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-[linear-gradient(180deg,#14B8A6,#0D9488)] px-4 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_14px_-4px_rgba(13,148,136,0.5)] transition-all hover:bg-[linear-gradient(180deg,#0D9488,#0F766E)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
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
        <p className="text-sm text-slate-500">
          {notes.length} nota{notes.length !== 1 ? 's' : ''} en total
        </p>
        {canCreate && (
          <Link
            href={`/pacientes/${patientId}/notas/nueva`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[linear-gradient(180deg,#14B8A6,#0D9488)] px-4 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_14px_-4px_rgba(13,148,136,0.5)] transition-all hover:bg-[linear-gradient(180deg,#0D9488,#0F766E)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
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
      className="glass-surface flex items-start gap-3 rounded-[18px] p-3.5 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
    >
      <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-slate-900/4 py-1.5 text-center">
        <span className="text-xs font-semibold text-slate-500">
          {formatMonthShort(note.noteDate)}
        </span>
        <span className="text-lg font-bold leading-tight text-slate-900">
          {formatDay(note.noteDate)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">
            {formatDate(note.noteDate)}
          </span>
          <ClinicalNoteStatusBadge isSigned={note.isSigned} />
          {visitType && (
            <span className="inline-flex items-center rounded-full bg-zinc-500/12 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {visitType}
            </span>
          )}
          {note.diagnoses.map((d) => d.code).filter(Boolean).slice(0, 2).map((code) => (
            <span
              key={code}
              className="inline-flex items-center rounded-full bg-blue-600/12 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-700"
            >
              {code}
            </span>
          ))}
        </div>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
          {displayText}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <User className="h-3 w-3 shrink-0" />
            {note.author.fullName}
          </span>
          {elapsed && (
            <span className="text-slate-400">↑ {elapsed}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
