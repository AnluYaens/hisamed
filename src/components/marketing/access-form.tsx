'use client';

import { useActionState } from 'react';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { submitAccessRequest, type AccessRequestState } from '@/actions/access-request';
import { formKey, echoValue } from '@/lib/forms/state';
import type { LandingCopy, Lang } from '@/components/marketing/copy';
import { whatsappHref } from '@/components/marketing/copy';

interface AccessFormProps {
  lang: Lang;
  t: LandingCopy['cta']['access'];
}

const FIELD_BASE =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

export function AccessForm({ lang, t }: AccessFormProps) {
  const [state, formAction, pending] = useActionState<AccessRequestState, FormData>(
    submitAccessRequest,
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

  const failed = state && state.success === false ? state : null;
  const fieldError = (name: string) => failed?.fieldErrors?.[name]?.[0];

  return (
    <form key={formKey(state)} action={formAction} className="flex flex-col gap-3" noValidate>
      <Field label={t.name} name="name" autoComplete="name" state={state} error={fieldError('name')} />
      <Field
        label={t.email}
        name="email"
        type="email"
        autoComplete="email"
        state={state}
        error={fieldError('email')}
      />
      <Field
        label={t.whatsapp}
        name="whatsapp"
        type="tel"
        autoComplete="tel"
        state={state}
        error={fieldError('whatsapp')}
      />
      <Field label={t.clinic} name="clinic" state={state} error={fieldError('clinic')} />
      <Field label={t.specialty} name="specialty" state={state} error={fieldError('specialty')} />

      {failed?.error && !failed.fieldErrors && (
        <p className="text-sm text-red-600">{failed.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#14B8A6,#0D9488)] px-5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_14px_-4px_rgba(13,148,136,0.5)] transition-all hover:bg-[linear-gradient(180deg,#0D9488,#0F766E)] active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? t.submitting : t.submit}
      </button>

      <div className="flex items-center gap-3 py-1 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        {t.or}
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <a
        href={whatsappHref(lang)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
      >
        <MessageCircle className="h-4 w-4 text-teal-600" />
        {t.whatsappButton}
      </a>
    </form>
  );
}

interface FieldProps {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  state: AccessRequestState;
  error?: string;
}

function Field({ label, name, type = 'text', autoComplete, state, error }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={echoValue(state, name) ?? ''}
        aria-invalid={error ? true : undefined}
        className={FIELD_BASE}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}
