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
          'inline-flex items-center gap-1 rounded-full bg-green-700/14 px-2.5 py-0.5 text-[11.5px] font-semibold text-green-700',
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
        'inline-flex items-center gap-1 rounded-full bg-amber-600/14 px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-700',
        className ?? '',
      ].join(' ')}
    >
      <FileEdit className="h-3 w-3" />
      Borrador
    </span>
  );
}
