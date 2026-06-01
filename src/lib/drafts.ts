/**
 * Local draft persistence for high-value forms (clinical notes + patient
 * create/edit). Drafts are stored in `localStorage` so a doctor who loses
 * their connection mid-write — or accidentally navigates away — does not lose
 * what they typed.
 *
 * This module is the pure storage layer: key construction, save/load/clear and
 * a stale-cleanup pass. It is intentionally framework-free and SSR-safe so it
 * can be unit-tested in a Node environment with a `localStorage` shim. The
 * React wiring lives in the `use*FormDraft` hooks.
 *
 * SCOPE: only the four forms enumerated in `DraftKind`. Do NOT generalize this
 * to other forms.
 */

const PREFIX = 'hisamed:draft:';

/**
 * Schema version. Bump this whenever a form's persisted shape changes in a way
 * that would make old drafts misload. It is embedded in every stored payload;
 * `loadDraft` discards any draft whose version doesn't match, so a deploy that
 * changes a form can't restore a stale, incompatible draft into it.
 */
export const DRAFT_SCHEMA_VERSION = 1;

/** Drafts older than this are auto-discarded on load / cleanup. */
export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

export interface StoredDraft<T> {
  /** Schema version the draft was written under. */
  v: number;
  /** Epoch ms when the draft was last saved. */
  savedAt: number;
  /** The form snapshot. */
  data: T;
}

export interface LoadedDraft<T> {
  savedAt: number;
  data: T;
}

// ── Key builders ─────────────────────────────────────────────────────────────
// Keys are specific enough that drafts never collide across patients, clinics,
// or modes — and, crucially, a different clinic's user on the same browser can
// never load another clinic's draft (tenant safety).

export function clinicalNoteCreateKey(patientId: string): string {
  return `${PREFIX}clinical-note:create:${patientId}`;
}

export function clinicalNoteEditKey(noteId: string): string {
  return `${PREFIX}clinical-note:edit:${noteId}`;
}

export function patientCreateKey(clinicId: string): string {
  return `${PREFIX}patient:create:${clinicId}`;
}

export function patientEditKey(patientId: string): string {
  return `${PREFIX}patient:edit:${patientId}`;
}

// ── Storage access (SSR-safe) ────────────────────────────────────────────────

function getStore(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    // Accessing localStorage can throw in some privacy modes.
    return null;
  }
}

/** Persist (or overwrite) a draft under `key`. No-op when storage is absent. */
export function saveDraft<T>(key: string, data: T, now: number = Date.now()): void {
  const store = getStore();
  if (!store) return;
  const payload: StoredDraft<T> = { v: DRAFT_SCHEMA_VERSION, savedAt: now, data };
  try {
    store.setItem(key, JSON.stringify(payload));
  } catch {
    // Quota or serialization failure — drafts are best-effort, so swallow.
  }
}

/**
 * Load a draft. Returns `null` (and deletes the entry) when it is missing,
 * unparseable, written under a different schema version, or older than
 * `maxAgeMs`.
 */
export function loadDraft<T>(
  key: string,
  maxAgeMs: number = DRAFT_MAX_AGE_MS,
  now: number = Date.now(),
): LoadedDraft<T> | null {
  const store = getStore();
  if (!store) return null;
  const raw = store.getItem(key);
  if (raw == null) return null;

  let parsed: StoredDraft<T> | null = null;
  try {
    parsed = JSON.parse(raw) as StoredDraft<T>;
  } catch {
    store.removeItem(key);
    return null;
  }

  if (
    !parsed ||
    typeof parsed.savedAt !== 'number' ||
    parsed.v !== DRAFT_SCHEMA_VERSION ||
    now - parsed.savedAt > maxAgeMs
  ) {
    store.removeItem(key);
    return null;
  }

  return { savedAt: parsed.savedAt, data: parsed.data };
}

/** Delete a draft. Called on successful submit. */
export function clearDraft(key: string): void {
  const store = getStore();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Single cleanup pass over all Hisamed drafts: removes any that are stale
 * (older than `maxAgeMs`) or written under an old schema version. Keeps
 * localStorage from accumulating dead drafts forever. Safe to call on mount.
 */
export function cleanupStaleDrafts(
  maxAgeMs: number = DRAFT_MAX_AGE_MS,
  now: number = Date.now(),
): void {
  const store = getStore();
  if (!store) return;

  const toRemove: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    const raw = store.getItem(key);
    if (raw == null) continue;
    try {
      const parsed = JSON.parse(raw) as StoredDraft<unknown>;
      if (
        !parsed ||
        typeof parsed.savedAt !== 'number' ||
        parsed.v !== DRAFT_SCHEMA_VERSION ||
        now - parsed.savedAt > maxAgeMs
      ) {
        toRemove.push(key);
      }
    } catch {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) store.removeItem(key);
}
