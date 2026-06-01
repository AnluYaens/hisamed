'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearDraft,
  cleanupStaleDrafts,
  loadDraft,
  saveDraft,
  DRAFT_MAX_AGE_MS,
  type LoadedDraft,
} from '@/lib/drafts';

interface UseFormDraftOptions<T> {
  /** localStorage key, or `null` to disable (e.g. id not yet known). */
  storageKey: string | null;
  /** Current serializable form snapshot. */
  value: T;
  /** Whether the snapshot holds enough to be worth saving / offering. */
  hasContent: (value: T) => boolean;
  /** Called when the user clicks "Restaurar" — apply the draft to the form. */
  onRestore: (data: T) => void;
  /** Disable entirely (defaults to true). */
  enabled?: boolean;
  /** Debounce window for writes (ms). */
  debounceMs?: number;
  /** Max draft age before auto-discard. */
  maxAgeMs?: number;
}

export interface UseFormDraftResult<T> {
  /** A fresh, restorable draft found on mount — show the restore banner. */
  pendingDraft: LoadedDraft<T> | null;
  /** Apply the pending draft and dismiss the banner. */
  restore: () => void;
  /** Delete the pending draft and dismiss the banner (start fresh). */
  discard: () => void;
  /** Clear the stored draft and reset the dirty baseline (call on save success). */
  clearAndReset: () => void;
  /**
   * Mark that a submit is in flight. If the component then unmounts (e.g. a
   * create action redirects on success), the draft is cleared. Validation
   * failures keep the component mounted, so they won't trigger this — call
   * `cancelSubmit()` from the error effect to be safe.
   */
  markSubmitting: () => void;
  /** Undo `markSubmitting` (call when a submit returns an error). */
  cancelSubmit: () => void;
}

/**
 * Draft persistence for a **controlled** form (React state is the source of
 * truth). Debounced auto-save as `value` changes, a mount-time check that
 * surfaces a restorable draft, and helpers to clear on success.
 *
 * Auto-save is gated on the snapshot actually differing from its initial
 * (mount) baseline AND `hasContent` — so a pristine "new note" form never
 * writes an essentially-empty draft, and an unedited "edit note" form never
 * mirrors the already-persisted note into localStorage.
 */
export function useFormDraft<T>({
  storageKey,
  value,
  hasContent,
  onRestore,
  enabled = true,
  debounceMs = 400,
  maxAgeMs = DRAFT_MAX_AGE_MS,
}: UseFormDraftOptions<T>): UseFormDraftResult<T> {
  const [pendingDraft, setPendingDraft] = useState<LoadedDraft<T> | null>(null);

  // Keep latest mutable values in refs so stable callbacks read fresh state.
  const valueRef = useRef(value);
  valueRef.current = value;
  const hasContentRef = useRef(hasContent);
  hasContentRef.current = hasContent;
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  // Baseline = the snapshot at first render. Auto-save only fires once the
  // form diverges from this, which keeps pristine/unedited forms quiet.
  const baselineRef = useRef<string>(JSON.stringify(value));
  const submittingRef = useRef(false);

  // ── Mount: cleanup stale + surface a restorable draft. Unmount: clear if a
  //    submit was in flight (covers create actions that redirect on success).
  useEffect(() => {
    if (!enabled || !storageKey) return;
    cleanupStaleDrafts(maxAgeMs);
    const loaded = loadDraft<T>(storageKey, maxAgeMs);
    if (loaded && hasContentRef.current(loaded.data)) {
      setPendingDraft(loaded);
    }
    return () => {
      if (submittingRef.current && storageKey) clearDraft(storageKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per key
  }, [storageKey, enabled]);

  // ── Debounced auto-save on change.
  useEffect(() => {
    if (!enabled || !storageKey) return;
    const json = JSON.stringify(value);
    if (json === baselineRef.current) return; // unchanged from mount → skip
    if (!hasContent(value)) return;
    const t = setTimeout(() => saveDraft(storageKey, value), debounceMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- value/storageKey are the inputs
  }, [value, storageKey, enabled, debounceMs]);

  const restore = useCallback(() => {
    setPendingDraft((cur) => {
      if (cur) onRestoreRef.current(cur.data);
      return null;
    });
  }, []);

  const discard = useCallback(() => {
    if (storageKey) clearDraft(storageKey);
    setPendingDraft(null);
  }, [storageKey]);

  const clearAndReset = useCallback(() => {
    if (storageKey) clearDraft(storageKey);
    // Reset baseline to the current value so the now-saved content isn't
    // immediately re-written as a new draft.
    baselineRef.current = JSON.stringify(valueRef.current);
    // The submit cycle is complete; disarm so a later cancel-navigation (after
    // the user resumes editing) doesn't wrongly clear a fresh draft.
    submittingRef.current = false;
  }, [storageKey]);

  const markSubmitting = useCallback(() => {
    submittingRef.current = true;
  }, []);

  const cancelSubmit = useCallback(() => {
    submittingRef.current = false;
  }, []);

  return { pendingDraft, restore, discard, clearAndReset, markSubmitting, cancelSubmit };
}
