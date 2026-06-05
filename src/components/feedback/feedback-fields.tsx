'use client';

import { useState } from 'react';
import type { FeedbackState } from '@/actions/feedback';
import { echoValue } from '@/lib/forms/state';
import {
  FEEDBACK_MESSAGE_MAX,
  type FeedbackCategory,
} from '@/lib/validators/feedback';

// Localized labels supplied by each surface (Spanish-only popover vs. the
// bilingual landing). The category/rating *values* are universal; only their
// labels change.
export interface FeedbackLabels {
  category: string;
  categoryOptions: ReadonlyArray<{ value: FeedbackCategory; label: string }>;
  rating: string;
  message: string;
  email: string;
  emailPlaceholder?: string;
  submit: string;
  submitting: string;
}

// Neutral, clear emoji scale (1–5). Shared by both surfaces.
const RATINGS: ReadonlyArray<{ value: number; emoji: string }> = [
  { value: 1, emoji: '😟' },
  { value: 2, emoji: '😕' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😄' },
];

const FIELD_BASE =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

interface FeedbackFieldsProps {
  labels: FeedbackLabels;
  state: FeedbackState;
  pending: boolean;
  /** Pre-filled (editable) follow-up email — the session email on the app. */
  defaultEmail?: string;
}

/**
 * The shared body of the feedback form: category, emoji rating, message and an
 * optional follow-up email, plus the submit button and a generic error line.
 * The enclosing `<form action={…}>` and `useActionState` live in each surface
 * so the markup around success/auto-close can differ.
 */
export function FeedbackFields({ labels, state, pending, defaultEmail }: FeedbackFieldsProps) {
  const failed = state && state.success === false ? state : null;
  const fieldError = (name: string) => failed?.fieldErrors?.[name]?.[0];

  // Local state only drives the visual "selected" styling — the actual values
  // are submitted by the underlying radio inputs (so it stays form-action native).
  const [category, setCategory] = useState<string>(echoValue(state, 'category') ?? '');
  const [rating, setRating] = useState<string>(echoValue(state, 'rating') ?? '');

  return (
    <div className="flex flex-col gap-4">
      {/* Category */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-[13px] font-medium text-slate-700">{labels.category}</legend>
        <div className="flex flex-wrap gap-2">
          {labels.categoryOptions.map((opt) => (
            <label
              key={opt.value}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                category === opt.value
                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="category"
                value={opt.value}
                checked={category === opt.value}
                onChange={() => setCategory(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
        {fieldError('category') && (
          <span className="text-xs text-red-600">{fieldError('category')}</span>
        )}
      </fieldset>

      {/* Rating */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-[13px] font-medium text-slate-700">{labels.rating}</legend>
        <div className="flex gap-2">
          {RATINGS.map((r) => {
            const value = String(r.value);
            const active = rating === value;
            return (
              <label
                key={r.value}
                title={value}
                className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border text-xl transition-all ${
                  active
                    ? 'border-teal-500 bg-teal-50 scale-110'
                    : 'border-slate-200 bg-white grayscale hover:grayscale-0'
                }`}
              >
                <input
                  type="radio"
                  name="rating"
                  value={value}
                  checked={active}
                  onChange={() => setRating(value)}
                  className="sr-only"
                />
                <span aria-hidden>{r.emoji}</span>
              </label>
            );
          })}
        </div>
        {fieldError('rating') && (
          <span className="text-xs text-red-600">{fieldError('rating')}</span>
        )}
      </fieldset>

      {/* Message */}
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-slate-700">{labels.message}</span>
        <textarea
          name="message"
          rows={4}
          maxLength={FEEDBACK_MESSAGE_MAX}
          defaultValue={echoValue(state, 'message') ?? ''}
          aria-invalid={fieldError('message') ? true : undefined}
          className={`${FIELD_BASE} resize-y`}
        />
        {fieldError('message') && (
          <span className="text-xs text-red-600">{fieldError('message')}</span>
        )}
      </label>

      {/* Optional follow-up email */}
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-slate-700">{labels.email}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder={labels.emailPlaceholder}
          defaultValue={echoValue(state, 'email') ?? defaultEmail ?? ''}
          aria-invalid={fieldError('email') ? true : undefined}
          className={FIELD_BASE}
        />
        {fieldError('email') && (
          <span className="text-xs text-red-600">{fieldError('email')}</span>
        )}
      </label>

      {failed?.error && !failed.fieldErrors && (
        <p className="text-sm text-red-600">{failed.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#14B8A6,#0D9488)] px-5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_14px_-4px_rgba(13,148,136,0.5)] transition-all hover:bg-[linear-gradient(180deg,#0D9488,#0F766E)] active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? labels.submitting : labels.submit}
      </button>
    </div>
  );
}
