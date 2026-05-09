'use client';

import { startTransition, useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  attachVitalSignsToNote,
  type AttachVitalSignsActionState,
} from '@/actions/vital-signs';

interface AttachVitalSignsButtonProps {
  vitalSignsId: string;
  /**
   * Target note id. `null` means "no note exists yet" (e.g. the doctor is on
   * /notas/nueva and hasn't saved the draft) — the button stays visible but
   * disabled with an explanatory tooltip, matching the spec.
   */
  clinicalNoteId: string | null;
  onAttached?: () => void;
}

export function AttachVitalSignsButton({
  vitalSignsId,
  clinicalNoteId,
  onAttached,
}: AttachVitalSignsButtonProps) {
  const router = useRouter();
  const [state, action, isPending] = useActionState<AttachVitalSignsActionState, FormData>(
    attachVitalSignsToNote,
    null,
  );

  // Refresh the page after a successful attach so the row moves out of the
  // "sin asociar" group on the next render. router.refresh re-runs the RSC
  // tree without a full navigation, which is what we want here.
  useEffect(() => {
    if (state?.success) {
      router.refresh();
      onAttached?.();
    }
  }, [state, router, onAttached]);

  const disabled = clinicalNoteId === null || isPending;
  const title =
    clinicalNoteId === null
      ? 'Guarda el borrador de la nota antes de asociar los signos vitales.'
      : 'Asociar estos signos vitales a esta nota.';

  function handleClick() {
    if (!clinicalNoteId) return;
    const fd = new FormData();
    fd.set('vital_signs_id', vitalSignsId);
    fd.set('clinical_note_id', clinicalNoteId);
    startTransition(() => {
      action(fd);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        title={title}
        onClick={handleClick}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Link2 className="h-3.5 w-3.5" />
        )}
        Asociar a esta nota
      </Button>
      {state && !state.success && (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </div>
  );
}
