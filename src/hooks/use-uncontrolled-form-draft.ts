'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  clearDraft,
  cleanupStaleDrafts,
  loadDraft,
  saveDraft,
  DRAFT_MAX_AGE_MS,
  type LoadedDraft,
} from '@/lib/drafts';

/** A snapshot of an uncontrolled form: field name → submitted string value. */
export type FormSnapshot = Record<string, string>;

interface UseUncontrolledFormDraftOptions {
  storageKey: string | null;
  /** Whether the snapshot holds enough to be worth saving / offering. */
  hasContent: (snapshot: FormSnapshot) => boolean;
  enabled?: boolean;
  debounceMs?: number;
  maxAgeMs?: number;
}

export interface UseUncontrolledFormDraftResult {
  pendingDraft: LoadedDraft<FormSnapshot> | null;
  /** Spread onto the `<form>`: provides the ref + the change listener. */
  formProps: {
    ref: (node: HTMLFormElement | null) => void;
    onInput: (e: FormEvent<HTMLFormElement>) => void;
  };
  restore: () => void;
  discard: () => void;
  clearAndReset: () => void;
  markSubmitting: () => void;
  cancelSubmit: () => void;
}

// Fields that must never be persisted. Password-like fields are sensitive;
// `patient_id` is a hidden identity field that the form re-supplies itself.
const EXCLUDED_FIELDS: ReadonlySet<string> = new Set([
  'password',
  'confirmPassword',
  'confirm_password',
  'newPassword',
  'new_password',
  'currentPassword',
  'current_password',
  'oldPassword',
  'old_password',
  'patient_id',
]);

/** Serialize a form's current values, dropping excluded + password inputs. */
function snapshotForm(form: HTMLFormElement): FormSnapshot {
  const out: FormSnapshot = {};
  const data = new FormData(form);
  for (const [k, v] of data.entries()) {
    if (EXCLUDED_FIELDS.has(k)) continue;
    if (typeof v !== 'string') continue; // skip File inputs
    out[k] = v;
  }
  // Defensively strip any remaining password inputs even if unnamed-excluded.
  for (const el of Array.from(form.elements)) {
    if (el instanceof HTMLInputElement && el.type === 'password' && el.name) {
      delete out[el.name];
    }
  }
  return out;
}

/** Write a snapshot back into an uncontrolled form's inputs. */
function applySnapshot(form: HTMLFormElement, snapshot: FormSnapshot): void {
  for (const el of Array.from(form.elements)) {
    if (
      !(el instanceof HTMLInputElement) &&
      !(el instanceof HTMLTextAreaElement) &&
      !(el instanceof HTMLSelectElement)
    ) {
      continue;
    }
    const name = el.name;
    if (!name || EXCLUDED_FIELDS.has(name)) continue;
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      // Checkboxes/radios only appear in the snapshot when checked (FormData
      // omits unchecked ones), with their `value`.
      el.checked = snapshot[name] === el.value;
    } else if (el instanceof HTMLInputElement && el.type === 'password') {
      continue;
    } else {
      el.value = snapshot[name] ?? '';
    }
  }
}

/**
 * Draft persistence for an **uncontrolled** form (DOM is the source of truth —
 * inputs use `defaultValue`). Unlike {@link useFormDraft}, this reads/writes
 * values straight off the form element via a ref:
 *   - `onInput` (debounced) snapshots the form on every keystroke.
 *   - `restore()` writes a saved snapshot back into the inputs.
 *
 * Auto-save is gated on the snapshot differing from the mount baseline AND
 * `hasContent`, so a pristine create form (only its select defaults) never
 * writes a draft.
 */
export function useUncontrolledFormDraft({
  storageKey,
  hasContent,
  enabled = true,
  debounceMs = 400,
  maxAgeMs = DRAFT_MAX_AGE_MS,
}: UseUncontrolledFormDraftOptions): UseUncontrolledFormDraftResult {
  const [pendingDraft, setPendingDraft] = useState<LoadedDraft<FormSnapshot> | null>(null);

  const formRef = useRef<HTMLFormElement | null>(null);
  const baselineRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasContentRef = useRef(hasContent);
  hasContentRef.current = hasContent;
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;

  // Capture the baseline (pristine / prefilled) snapshot once the form mounts.
  const setRef = useCallback((node: HTMLFormElement | null) => {
    formRef.current = node;
    if (node && baselineRef.current === null) {
      baselineRef.current = JSON.stringify(snapshotForm(node));
    }
  }, []);

  // ── Mount: cleanup + surface a restorable draft. Unmount: clear if mid-submit.
  useEffect(() => {
    if (!enabled || !storageKey) return;
    cleanupStaleDrafts(maxAgeMs);
    const loaded = loadDraft<FormSnapshot>(storageKey, maxAgeMs);
    if (loaded && hasContentRef.current(loaded.data)) {
      setPendingDraft(loaded);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (submittingRef.current && storageKeyRef.current) clearDraft(storageKeyRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per key
  }, [storageKey, enabled]);

  const onInput = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      if (!enabled) return;
      const form = e.currentTarget;
      const snapshot = snapshotForm(form);
      const json = JSON.stringify(snapshot);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const key = storageKeyRef.current;
        if (!key) return;
        if (json === baselineRef.current) return; // unchanged from mount
        if (!hasContentRef.current(snapshot)) return;
        saveDraft(key, snapshot);
      }, debounceMs);
    },
    [enabled, debounceMs],
  );

  const restore = useCallback(() => {
    setPendingDraft((cur) => {
      if (cur && formRef.current) applySnapshot(formRef.current, cur.data);
      return null;
    });
  }, []);

  const discard = useCallback(() => {
    if (storageKey) clearDraft(storageKey);
    setPendingDraft(null);
  }, [storageKey]);

  const clearAndReset = useCallback(() => {
    if (storageKey) clearDraft(storageKey);
    if (formRef.current) baselineRef.current = JSON.stringify(snapshotForm(formRef.current));
    // Submit cycle complete; disarm the unmount-time cleanup so a later
    // cancel-navigation (after the user resumes editing) preserves the draft.
    submittingRef.current = false;
  }, [storageKey]);

  const markSubmitting = useCallback(() => {
    submittingRef.current = true;
  }, []);

  const cancelSubmit = useCallback(() => {
    submittingRef.current = false;
  }, []);

  return {
    pendingDraft,
    formProps: { ref: setRef, onInput },
    restore,
    discard,
    clearAndReset,
    markSubmitting,
    cancelSubmit,
  };
}
