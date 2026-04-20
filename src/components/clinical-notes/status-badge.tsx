import { CheckCircle2, FileEdit } from 'lucide-react';

interface ClinicalNoteStatusBadgeProps {
  isSigned: boolean;
  className?: string;
}

export function ClinicalNoteStatusBadge({ isSigned, className }: ClinicalNoteStatusBadgeProps) {
  if (isSigned) {
    return (
      <span
        className={[
          'inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700',
          'dark:bg-emerald-900/30 dark:text-emerald-300',
          className ?? '',
        ].join(' ')}
      >
        <CheckCircle2 className="h-3 w-3" />
        Firmada
      </span>
    );
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700',
        'dark:bg-amber-900/30 dark:text-amber-300',
        className ?? '',
      ].join(' ')}
    >
      <FileEdit className="h-3 w-3" />
      Borrador
    </span>
  );
}
