'use client';

import { useActionState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { submitFeedback, type FeedbackState } from '@/actions/feedback';
import { formKey } from '@/lib/forms/state';
import { FeedbackFields, type FeedbackLabels } from '@/components/feedback/feedback-fields';
import type { LandingCopy } from '@/components/marketing/copy';

interface FeedbackFormProps {
  t: LandingCopy['feedback'];
}

// Bridges the landing's bilingual copy onto the shared field labels.
function toLabels(t: LandingCopy['feedback']): FeedbackLabels {
  return {
    category: t.category,
    categoryOptions: [
      { value: 'bug', label: t.categoryBug },
      { value: 'suggestion', label: t.categorySuggestion },
      { value: 'general', label: t.categoryGeneral },
    ],
    rating: t.rating,
    message: t.message,
    email: t.email,
    emailPlaceholder: t.emailPlaceholder,
    submit: t.submit,
    submitting: t.submitting,
  };
}

export function FeedbackForm({ t }: FeedbackFormProps) {
  const [state, formAction, pending] = useActionState<FeedbackState, FormData>(
    submitFeedback,
    null,
  );

  if (state?.success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-6 py-10 text-center">
        <CheckCircle2 className="h-10 w-10 text-teal-600" />
        <p className="text-base font-semibold text-teal-900">{t.success}</p>
      </div>
    );
  }

  return (
    <form key={formKey(state)} action={formAction} noValidate>
      <FeedbackFields labels={toLabels(t)} state={state} pending={pending} />
    </form>
  );
}
