import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DRAFT_MAX_AGE_MS,
  clearDraft,
  cleanupStaleDrafts,
  clinicalNoteCreateKey,
  clinicalNoteEditKey,
  loadDraft,
  patientCreateKey,
  patientEditKey,
  saveDraft,
} from '@/lib/drafts';

// ── Minimal localStorage shim (vitest runs in the Node environment) ──────────
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number): string | null {
    return Array.from(this.map.keys())[i] ?? null;
  }
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
}

beforeEach(() => {
  (globalThis as { localStorage: Storage }).localStorage = new MemoryStorage();
});
afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

// A representative clinical-note draft snapshot.
function sampleNoteDraft() {
  return {
    textData: {
      note_date: '2026-06-01',
      chief_complaint: 'Control rutinario',
      subjective: 'Paciente refiere dolor pélvico de 3 días.',
      objective: '',
      assessment: '',
      plan: '',
      internal_notes: '',
    },
    diagnoses: [{ code: 'N94.6', description: 'Dismenorrea' }],
    specialty: { blood_pressure: '120/80' },
  };
}

describe('clinical note draft lifecycle', () => {
  const key = clinicalNoteCreateKey('patient-123');

  it('saves a draft and restores the exact snapshot', () => {
    const draft = sampleNoteDraft();
    saveDraft(key, draft);

    const loaded = loadDraft<typeof draft>(key);
    expect(loaded).not.toBeNull();
    expect(loaded!.data).toEqual(draft);
    expect(typeof loaded!.savedAt).toBe('number');
  });

  it('overwrites an existing draft on re-save (debounced writes land here)', () => {
    saveDraft(key, sampleNoteDraft());
    const updated = sampleNoteDraft();
    updated.textData.subjective = 'Texto actualizado mientras escribe.';
    saveDraft(key, updated);

    const loaded = loadDraft<ReturnType<typeof sampleNoteDraft>>(key);
    expect(loaded!.data.textData.subjective).toBe('Texto actualizado mientras escribe.');
  });

  it('clears the draft on successful submit', () => {
    saveDraft(key, sampleNoteDraft());
    expect(loadDraft(key)).not.toBeNull();

    clearDraft(key);
    expect(loadDraft(key)).toBeNull();
  });

  it('does not restore a draft older than 24h and removes it', () => {
    const old = Date.now() - (DRAFT_MAX_AGE_MS + 60_000);
    saveDraft(key, sampleNoteDraft(), old);

    expect(loadDraft(key)).toBeNull();
    // The stale entry was deleted as a side effect of the failed load.
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('restores a draft that is just under 24h old', () => {
    const recent = Date.now() - (DRAFT_MAX_AGE_MS - 60_000);
    saveDraft(key, sampleNoteDraft(), recent);
    expect(loadDraft(key)).not.toBeNull();
  });

  it('discards drafts written under an older schema version', () => {
    localStorage.setItem(key, JSON.stringify({ v: 0, savedAt: Date.now(), data: sampleNoteDraft() }));
    expect(loadDraft(key)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('returns null on corrupt JSON without throwing', () => {
    localStorage.setItem(key, '{not valid json');
    expect(() => loadDraft(key)).not.toThrow();
    expect(loadDraft(key)).toBeNull();
  });
});

describe('draft key isolation (tenant / patient / mode safety)', () => {
  it('keys never collide across patients, notes, clinics, or modes', () => {
    const keys = [
      clinicalNoteCreateKey('patient-A'),
      clinicalNoteCreateKey('patient-B'),
      clinicalNoteEditKey('note-1'),
      patientCreateKey('clinic-X'),
      patientCreateKey('clinic-Y'),
      patientEditKey('patient-A'),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('a draft saved for one patient is invisible under another patient key', () => {
    saveDraft(clinicalNoteCreateKey('patient-A'), sampleNoteDraft());
    expect(loadDraft(clinicalNoteCreateKey('patient-B'))).toBeNull();
  });

  it("one clinic's create draft cannot be loaded with another clinic's key", () => {
    saveDraft(patientCreateKey('clinic-X'), { first_name: 'Ana' });
    expect(loadDraft(patientCreateKey('clinic-Y'))).toBeNull();
    expect(loadDraft<{ first_name: string }>(patientCreateKey('clinic-X'))!.data.first_name).toBe(
      'Ana',
    );
  });
});

describe('cleanupStaleDrafts', () => {
  it('removes only stale / bad drafts and keeps fresh ones in a single pass', () => {
    const fresh = clinicalNoteCreateKey('fresh');
    const stale = clinicalNoteEditKey('stale');
    const badVersion = patientCreateKey('badver');
    const corrupt = patientEditKey('corrupt');
    const unrelated = 'some-other-app-key';

    saveDraft(fresh, sampleNoteDraft());
    saveDraft(stale, sampleNoteDraft(), Date.now() - (DRAFT_MAX_AGE_MS + 1));
    localStorage.setItem(badVersion, JSON.stringify({ v: 0, savedAt: Date.now(), data: {} }));
    localStorage.setItem(corrupt, 'garbage');
    localStorage.setItem(unrelated, 'keep-me');

    cleanupStaleDrafts();

    expect(loadDraft(fresh)).not.toBeNull();
    expect(localStorage.getItem(stale)).toBeNull();
    expect(localStorage.getItem(badVersion)).toBeNull();
    expect(localStorage.getItem(corrupt)).toBeNull();
    // Non-Hisamed keys are never touched.
    expect(localStorage.getItem(unrelated)).toBe('keep-me');
  });
});
