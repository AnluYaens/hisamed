import { Download, FileText, Image as ImageIcon, Paperclip } from 'lucide-react';
import type { UserRole } from '@/lib/db/schema';
import type { AttachmentListItem } from '@/queries/attachments';
import type { AttachmentCategory } from '@/lib/validators/attachment';
import { DeleteAttachmentButton } from '@/components/attachments/delete-attachment-button';

interface AttachmentListProps {
  attachments: AttachmentListItem[];
  sessionUserId: string;
  sessionRole: UserRole;
  /** IANA timezone for formatting uploadedAt in the clinic's wall-clock time. */
  timeZone: string;
}

const CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  lab_result: 'Laboratorio',
  imaging: 'Imagen',
  consent: 'Consentimiento',
  prescription: 'Récipe',
  procedure_photo: 'Foto procedimiento',
  ultrasound: 'Ecografía',
  other: 'Otro',
};

const CATEGORY_STYLES: Record<AttachmentCategory, string> = {
  lab_result:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  imaging: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  consent: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  prescription: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  procedure_photo:
    'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  ultrasound:
    'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  other: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}

function canDelete(
  att: AttachmentListItem,
  sessionUserId: string,
  sessionRole: UserRole,
): boolean {
  // Signed-note immutability: a signed clinical note locks all linked
  // evidence. Mirrors the server-side guard in `deleteAttachment` so the UI
  // never offers an action the server would reject. Applies to every role,
  // including admin.
  if (att.clinicalNoteId && att.clinicalNoteIsSigned === true) return false;
  if (sessionRole === 'admin') return true;
  if (sessionRole === 'doctor') return att.uploadedBy === sessionUserId;
  return false;
}

export function AttachmentList({
  attachments,
  sessionUserId,
  sessionRole,
  timeZone,
}: AttachmentListProps) {
  if (attachments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <Paperclip className="mb-2 h-5 w-5 text-zinc-400" />
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Aún no hay adjuntos
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Sube PDFs o imágenes relacionadas con este paciente.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {attachments.map((att) => {
        const Icon = isImage(att.fileType) ? ImageIcon : FileText;
        const category = (att.category ?? 'other') as AttachmentCategory;
        const showDelete = canDelete(att, sessionUserId, sessionRole);

        return (
          <li
            key={att.id}
            className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100"
                  title={att.fileName}
                >
                  {att.fileName}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatBytes(att.fileSizeBytes)} · {formatDateTime(att.uploadedAt, timeZone)}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Subido por {att.uploader.fullName}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span
                className={[
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                  CATEGORY_STYLES[category],
                ].join(' ')}
              >
                {CATEGORY_LABELS[category]}
              </span>
              {att.description && (
                <span
                  className="truncate text-xs text-zinc-500 dark:text-zinc-400"
                  title={att.description}
                >
                  {att.description}
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center justify-end gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
              <a
                href={`/api/attachments/${att.id}/download`}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                aria-label={`Descargar ${att.fileName}`}
              >
                <Download className="h-3.5 w-3.5" />
                Descargar
              </a>
              {showDelete && (
                <DeleteAttachmentButton attachmentId={att.id} fileName={att.fileName} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
