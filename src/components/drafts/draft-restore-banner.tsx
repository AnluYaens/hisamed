'use client';

import { History, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

function formatSavedAt(savedAt: number): string {
  // The draft was saved on *this* browser, so the device's local clock is the
  // right frame for "when you were last writing". DD/MM HH:MM.
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(savedAt));
}

interface DraftRestoreBannerProps {
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}

/**
 * Prompt shown on form mount when a fresh (<24h) draft exists. Drafts are
 * never auto-loaded — the doctor explicitly chooses to restore or discard, so
 * stale data never silently reappears in the form.
 */
export function DraftRestoreBanner({ savedAt, onRestore, onDiscard }: DraftRestoreBannerProps) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-2xl border border-amber-600/25 bg-amber-100/70 px-4 py-3.5 text-sm text-amber-900 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
    >
      <div className="flex items-start gap-2.5">
        <History className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p>
          ¿Restaurar borrador del{' '}
          <strong className="font-semibold">{formatSavedAt(savedAt)}</strong>?
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" size="sm" onClick={onRestore}>
          <History className="h-3.5 w-3.5" />
          Restaurar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
          <X className="h-3.5 w-3.5" />
          Descartar
        </Button>
      </div>
    </div>
  );
}
