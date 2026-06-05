'use client';

import { useActionState, useEffect, useState } from 'react';
import { MessageCircle, CheckCircle2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { submitFeedback, type FeedbackState } from '@/actions/feedback';
import { formKey } from '@/lib/forms/state';
import { FeedbackFields, type FeedbackLabels } from '@/components/feedback/feedback-fields';

// The dashboard surface is Spanish-only, matching the rest of the app.
const ES: FeedbackLabels = {
  category: 'Categoría',
  categoryOptions: [
    { value: 'bug', label: 'Error / Bug' },
    { value: 'suggestion', label: 'Sugerencia / Funcionalidad' },
    { value: 'general', label: 'Comentario general' },
  ],
  rating: '¿Cómo calificarías tu experiencia?',
  message: 'Mensaje',
  email: 'Correo (opcional)',
  emailPlaceholder: 'Para darte seguimiento',
  submit: 'Enviar comentario',
  submitting: 'Enviando…',
};

const SUCCESS = '¡Gracias por tu comentario!';

/**
 * Discreet feedback entry point in the dashboard top bar: a small icon button
 * that opens a popover with the form. Kept out of the main workflow. On a
 * successful submit it shows a thank-you and auto-closes after a few seconds.
 */
export function FeedbackPopover({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  // Bumped on every close so the next open remounts FeedbackPanel with fresh
  // action state — otherwise the thank-you would persist after auto-close.
  const [instance, setInstance] = useState(0);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setInstance((n) => n + 1);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Enviar comentario"
            title="Enviar comentario"
            className="inline-flex items-center justify-center rounded-full p-2 text-zinc-500 transition-colors duration-150 hover:bg-slate-900/6 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        }
      />
      <PopoverContent align="end" sideOffset={8} className="w-80 p-4">
        <FeedbackPanel key={instance} userEmail={userEmail} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

// Holds the action state for a single open session. Remounted (via key) on each
// fresh open so a previous success doesn't linger.
function FeedbackPanel({ userEmail, onDone }: { userEmail: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<FeedbackState, FormData>(
    submitFeedback,
    null,
  );

  // Auto-close shortly after a successful submission.
  useEffect(() => {
    if (state?.success) {
      const id = setTimeout(onDone, 3000);
      return () => clearTimeout(id);
    }
  }, [state, onDone]);

  if (state?.success) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-teal-600" />
        <p className="text-sm font-semibold text-teal-900">{SUCCESS}</p>
      </div>
    );
  }

  return (
    <form key={formKey(state)} action={formAction} noValidate>
      <p className="mb-3 text-sm font-semibold text-slate-900">Comparte tu opinión</p>
      <FeedbackFields labels={ES} state={state} pending={pending} defaultEmail={userEmail} />
    </form>
  );
}
