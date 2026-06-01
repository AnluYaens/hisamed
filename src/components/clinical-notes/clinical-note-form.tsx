'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PenLine,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  createClinicalNote,
  signClinicalNote,
  updateClinicalNote,
  type ClinicalNoteActionState,
} from '@/actions/clinical-notes';
import type {
  ClinicalNoteSpecialtyData,
  DiagnosisEntry,
  GynecologicalExam,
  Ultrasound,
} from '@/lib/validators/clinical-note';
import { bloodPressureRegex } from '@/lib/validators/clinical-note';
import { DiagnosisListEditor } from '@/components/ui/diagnosis-list-editor';
import { GynecologicalExamSection } from '@/components/clinical-notes/gynecological-exam-section';
import {
  UltrasoundSection,
  type AttachmentMeta as UltrasoundAttachmentMeta,
} from '@/components/clinical-notes/ultrasound-section';
import { consultationReasonPhrases } from '@/lib/constants/medical-phrases';
import { useFormDraft } from '@/hooks/use-form-draft';
import { DraftRestoreBanner } from '@/components/drafts/draft-restore-banner';
import { clinicalNoteCreateKey, clinicalNoteEditKey } from '@/lib/drafts';

// ─── Shared input classes ─────────────────────────────────────────────────────

function fieldClass(hasError = false) {
  return [
    'glass-input flex h-9 w-full rounded-[14px] px-3.5 text-sm text-slate-900 outline-none',
    'placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60',
    hasError ? 'border-red-400 focus:ring-red-500/20' : '',
  ].join(' ');
}

function textareaClass(hasError = false) {
  return [
    'glass-input w-full resize-y rounded-[14px] px-3.5 py-2 text-sm text-slate-900 outline-none',
    'placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60',
    hasError ? 'border-red-400 focus:ring-red-500/20' : '',
  ].join(' ');
}

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[13px] font-semibold text-slate-700"
    >
      {children}
    </label>
  );
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface TextFields {
  note_date: string;
  chief_complaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  internal_notes: string;
}

type SpecialtyState = {
  blood_pressure: string;
  weight_kg: string;
  height_cm: string;
  bmi: string;
  last_menstrual_period: string;
  gestational_age_weeks: string;
  ultrasound_findings: string;
  follicle_count_left: string;
  follicle_count_right: string;
  endometrial_thickness_mm: string;
  procedure_performed: string;
  treatment_protocol: string;
  // The gynecological exam is a structured nested object; keep it as-is
  // (no string-flattening) since selects + checkboxes consume the typed
  // shape directly. Empty/cleared = `{}`.
  gynecological_exam: GynecologicalExam;
  // Same approach for the ultrasound blob. The form mutates the typed
  // value directly via `UltrasoundSection`; we only stringify on submit.
  ultrasound: Ultrasound;
};

function emptyTextFields(defaults: Partial<TextFields> = {}): TextFields {
  return {
    note_date: defaults.note_date ?? '',
    chief_complaint: defaults.chief_complaint ?? '',
    subjective: defaults.subjective ?? '',
    objective: defaults.objective ?? '',
    assessment: defaults.assessment ?? '',
    plan: defaults.plan ?? '',
    internal_notes: defaults.internal_notes ?? '',
  };
}

// Next.js serializes `Date` props to ISO strings when passing Server → Client.
// Using `.toISOString()` only works on real `Date` objects — on strings it
// yields `undefined`, so `recordKey` was always `'new'` and the resync logic
// broke. Normalize to a stable string key.
function recordKeyFromUpdatedAt(updatedAt: unknown): string {
  if (updatedAt == null) return 'new';
  if (typeof updatedAt === 'string') return updatedAt;
  if (updatedAt instanceof Date) return updatedAt.toISOString();
  return 'new';
}

function buildSpecialtyState(d: ClinicalNoteSpecialtyData | null | undefined): SpecialtyState {
  return {
    blood_pressure: d?.blood_pressure ?? '',
    weight_kg: d?.weight_kg != null ? String(d.weight_kg) : '',
    height_cm: d?.height_cm != null ? String(d.height_cm) : '',
    bmi: d?.bmi != null ? String(d.bmi) : '',
    last_menstrual_period: d?.last_menstrual_period ?? '',
    gestational_age_weeks: d?.gestational_age_weeks != null ? String(d.gestational_age_weeks) : '',
    ultrasound_findings: d?.ultrasound_findings ?? '',
    follicle_count_left: d?.follicle_count_left != null ? String(d.follicle_count_left) : '',
    follicle_count_right: d?.follicle_count_right != null ? String(d.follicle_count_right) : '',
    endometrial_thickness_mm:
      d?.endometrial_thickness_mm != null ? String(d.endometrial_thickness_mm) : '',
    procedure_performed: d?.procedure_performed ?? '',
    treatment_protocol: d?.treatment_protocol ?? '',
    gynecological_exam: d?.gynecological_exam ?? {},
    ultrasound: d?.ultrasound ?? {},
  };
}

// Has any meaningful (non-empty) value been entered into the ultrasound blob?
// Used both to decide whether to persist it and (in the read view) whether to
// render the ecography section at all.
function ultrasoundHasContent(u: Ultrasound | undefined): boolean {
  if (!u) return false;
  const hasIds = (u.image_attachment_ids?.length ?? 0) > 0;
  if (hasIds) return true;
  const gyn = u.gynecological;
  const obs = u.obstetric;
  const checkObj = (o: unknown): boolean => {
    if (o == null || typeof o !== 'object') return false;
    return Object.values(o as Record<string, unknown>).some((v) => {
      if (v == null || v === '') return false;
      if (typeof v === 'object') return checkObj(v);
      return true;
    });
  };
  return checkObj(gyn) || checkObj(obs);
}

// Serialize the UI-friendly string state into the JSON payload expected by
// the server action. Empty strings map to undefined so Zod's optional-nullable
// rules treat them as "not provided" instead of failing `coerce.number()`.
function serializeSpecialty(s: SpecialtyState): ClinicalNoteSpecialtyData {
  const num = (v: string): number | undefined => {
    if (v.trim() === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const str = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());

  const out: ClinicalNoteSpecialtyData = {
    blood_pressure: str(s.blood_pressure),
    weight_kg: num(s.weight_kg),
    height_cm: num(s.height_cm),
    bmi: num(s.bmi),
    last_menstrual_period: str(s.last_menstrual_period),
    gestational_age_weeks: num(s.gestational_age_weeks),
    ultrasound_findings: str(s.ultrasound_findings),
    follicle_count_left: num(s.follicle_count_left),
    follicle_count_right: num(s.follicle_count_right),
    endometrial_thickness_mm: num(s.endometrial_thickness_mm),
    procedure_performed: str(s.procedure_performed),
    treatment_protocol: str(s.treatment_protocol),
    // Only persist the gynecological_exam blob when it has at least one
    // non-empty key. An always-present `{}` would otherwise overwrite the
    // existing value on partial saves and is just noise in the audit log.
    gynecological_exam:
      Object.keys(s.gynecological_exam).length > 0 ? s.gynecological_exam : undefined,
    // Same guard for ultrasound: a stray `{}` would shadow whatever was
    // persisted previously, so we only send it once the doctor has actually
    // entered something.
    ultrasound: ultrasoundHasContent(s.ultrasound) ? s.ultrasound : undefined,
  };
  return out;
}

// ─── Local draft snapshot ─────────────────────────────────────────────────────
// The whole editable form state, persisted to localStorage so a dropped
// connection mid-write doesn't lose the note. note_date is intentionally NOT
// part of the "has content" check — a pristine create form already has it set
// to today, and we don't want to offer to restore an otherwise-empty draft.

interface ClinicalNoteDraft {
  textData: TextFields;
  diagnoses: DiagnosisEntry[];
  specialty: SpecialtyState;
}

function clinicalNoteDraftHasContent(d: ClinicalNoteDraft): boolean {
  const t = d.textData;
  const textFilled = [
    t.chief_complaint,
    t.subjective,
    t.objective,
    t.assessment,
    t.plan,
    t.internal_notes,
  ].some((s) => s.trim() !== '');
  if (textFilled) return true;
  if (d.diagnoses.length > 0) return true;
  // Any specialty/exam/ultrasound field entered counts as content.
  return Object.values(serializeSpecialty(d.specialty)).some((v) => v !== undefined);
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ExistingNote {
  id: string;
  noteDate: string;
  chiefComplaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  diagnoses: DiagnosisEntry[];
  internalNotes: string | null;
  specialtyData: ClinicalNoteSpecialtyData | null;
  isSigned: boolean;
  signedAt: Date | null;
  /** Server may pass a `Date` or an ISO string after RSC serialization. */
  updatedAt: Date | string;
}

interface ClinicalNoteFormProps {
  patientId: string;
  /** When null, we're in CREATE mode. When set, we're in EDIT mode. */
  note: ExistingNote | null;
  /** YYYY-MM-DD in the clinic TZ, used as the default note_date on create. */
  todayStr: string;
  /** Optional cita to auto-associate (e.g. when clicked from the agenda). */
  appointmentId?: string | null;
  /**
   * Metadata for ultrasound attachments already linked to this note (edit
   * mode). Lets the gallery render existing thumbnails without an extra
   * fetch — the page already loads attachments for the AttachmentList.
   */
  ultrasoundAttachments?: UltrasoundAttachmentMeta[];
}

export function ClinicalNoteForm({
  patientId,
  note,
  todayStr,
  appointmentId,
  ultrasoundAttachments,
}: ClinicalNoteFormProps) {
  const router = useRouter();
  const isEdit = note !== null;

  // useActionState hooks for each server action. We bind them via an intent
  // dispatcher below ("save draft" vs "sign") so a single form submit can
  // route to the right action.
  const [createState, createAction, isCreating] = useActionState<
    ClinicalNoteActionState,
    FormData
  >(createClinicalNote, null);
  const [updateState, updateAction, isUpdating] = useActionState<
    ClinicalNoteActionState,
    FormData
  >(updateClinicalNote, null);
  const [signState, signAction, isSigning] = useActionState<
    ClinicalNoteActionState,
    FormData
  >(signClinicalNote, null);

  const state = isEdit ? updateState : createState;
  const isPending = isCreating || isUpdating || isSigning;

  // Local form state — controlled inputs so we can (a) compute BMI live and
  // (b) resync from the server snapshot after a successful save.
  const [textData, setTextData] = useState<TextFields>(() =>
    emptyTextFields({
      note_date: note?.noteDate ?? todayStr,
      chief_complaint: note?.chiefComplaint ?? '',
      subjective: note?.subjective ?? '',
      objective: note?.objective ?? '',
      assessment: note?.assessment ?? '',
      plan: note?.plan ?? '',
      internal_notes: note?.internalNotes ?? '',
    }),
  );
  const [diagnoses, setDiagnoses] = useState<DiagnosisEntry[]>(() => note?.diagnoses ?? []);
  const [specialty, setSpecialty] = useState<SpecialtyState>(() =>
    buildSpecialtyState(note?.specialtyData ?? null),
  );

  // ── Sign confirmation dialog state ──────────────────────────────────────────
  // Must stay with the other useState calls *before* any useEffect. Putting
  // useState between two useEffects breaks the Rules of Hooks in practice
  // ("Rendered more hooks than during the previous render" in dev).
  const [signDialogOpen, setSignDialogOpen] = useState(false);

  // Flag for the "Firmar" flow: we always persist the current form values
  // first (via updateAction) and only trigger signAction once the update has
  // committed. A ref — not state — because flipping it must not itself cause
  // a re-render (the relevant transitions come from updateState / isUpdating).
  const signAfterUpdate = useRef(false);

  // Resync only when `updatedAt` changes (after a successful save / server
  // refresh). Do NOT depend on `note` object identity — the parent passes an
  // inline object every RSC render, so `[note]` would fire every paint and
  // wipe the user's in-progress edits.
  const recordKey = note ? recordKeyFromUpdatedAt(note.updatedAt) : 'new';

  // ── Local draft persistence ────────────────────────────────────────────────
  // Keyed so drafts never collide across patients (create) or notes (edit).
  const draftKey = isEdit ? clinicalNoteEditKey(note.id) : clinicalNoteCreateKey(patientId);
  const draft = useFormDraft<ClinicalNoteDraft>({
    storageKey: draftKey,
    value: { textData, diagnoses, specialty },
    hasContent: clinicalNoteDraftHasContent,
    onRestore: (d) => {
      setTextData(d.textData);
      setDiagnoses(d.diagnoses);
      setSpecialty(d.specialty);
    },
  });

  const signSucceeded = signState?.success && signState.signed === true;

  useEffect(() => {
    if (!note) return;
    setTextData(
      emptyTextFields({
        note_date: note.noteDate ?? todayStr,
        chief_complaint: note.chiefComplaint ?? '',
        subjective: note.subjective ?? '',
        objective: note.objective ?? '',
        assessment: note.assessment ?? '',
        plan: note.plan ?? '',
        internal_notes: note.internalNotes ?? '',
      }),
    );
    setDiagnoses(note.diagnoses ?? []);
    setSpecialty(buildSpecialtyState(note.specialtyData ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only `recordKey` (updatedAt) should trigger a resync
  }, [recordKey]);

  // Post-sign navigation: push to read-only view once the sign action succeeds.
  useEffect(() => {
    if (signSucceeded && note?.id) {
      router.refresh();
      router.push(`/pacientes/${patientId}/notas/${note.id}`);
    }
  }, [signSucceeded, note?.id, patientId, router]);

  // Save-then-sign chaining. When "Firmar" is clicked we first kick off
  // updateAction; this effect fires after that update settles and — if it
  // succeeded — dispatches signAction. `isUpdating` guards against reading a
  // stale `updateState` from a previous save while the new one is in flight.
  useEffect(() => {
    if (!signAfterUpdate.current) return;
    if (isUpdating) return;
    if (!updateState) return;
    if (updateState.success) {
      signAfterUpdate.current = false;
      if (!note?.id) return;
      const signFd = new FormData();
      signFd.set('note_id', note.id);
      startTransition(() => {
        signAction(signFd);
      });
    } else {
      // Persist failed → abort the sign flow. The error banner surfaces
      // the validation / permission message from updateState.
      signAfterUpdate.current = false;
    }
  }, [isUpdating, updateState, note?.id, signAction]);

  // Clear the local draft once the note is safely persisted; re-arm saving if
  // a submit comes back with an error (validation keeps us mounted).
  const { clearAndReset: clearDraftState, cancelSubmit: cancelDraftSubmit } = draft;
  useEffect(() => {
    if (state?.success) clearDraftState();
    else if (state && !state.success) cancelDraftSubmit();
  }, [state, clearDraftState, cancelDraftSubmit]);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  function setText<K extends keyof TextFields>(key: K, value: string) {
    setTextData((prev) => ({ ...prev, [key]: value }));
  }

  function setSpec<K extends keyof SpecialtyState>(key: K, value: string) {
    setSpecialty((prev) => ({ ...prev, [key]: value }));
  }

  // ── BMI auto-calc ──────────────────────────────────────────────────────────
  // Height is stored in cm (for gynecology forms this is universal). Weight
  // in kg. Formula: kg / (m^2). Rounded to one decimal so the UI stays quiet.
  function recomputeBmi(nextWeight: string, nextHeight: string) {
    const w = Number(nextWeight);
    const h = Number(nextHeight);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      setSpec('bmi', '');
      return;
    }
    const meters = h / 100;
    const bmi = w / (meters * meters);
    setSpec('bmi', Number.isFinite(bmi) ? bmi.toFixed(1) : '');
  }

  function onWeightChange(v: string) {
    setSpec('weight_kg', v);
    recomputeBmi(v, specialty.height_cm);
  }
  function onHeightChange(v: string) {
    setSpec('height_cm', v);
    recomputeBmi(specialty.weight_kg, v);
  }

  // ── Submit handler ─────────────────────────────────────────────────────────
  // Both "draft save" and "sign" start with the same write of the current
  // form values (so signing also persists any unsaved edits). Sign then
  // calls `signClinicalNote` with the note id.

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set('patient_id', patientId);
    if (appointmentId) fd.set('appointment_id', appointmentId);
    if (isEdit) fd.set('note_id', note.id);

    fd.set('note_date', textData.note_date);
    fd.set('chief_complaint', textData.chief_complaint);
    fd.set('subjective', textData.subjective);
    fd.set('objective', textData.objective);
    fd.set('assessment', textData.assessment);
    fd.set('plan', textData.plan);
    fd.set('diagnoses', JSON.stringify(diagnoses));
    fd.set('internal_notes', textData.internal_notes);
    fd.set('specialty_data', JSON.stringify(serializeSpecialty(specialty)));

    return fd;
  }

  function handleSaveDraft() {
    const fd = buildFormData();
    // Arm draft cleanup: on a create the action redirects on success and the
    // component unmounts, so we clear the local draft from the unmount path.
    draft.markSubmitting();
    // useActionState actions must run inside startTransition when invoked from
    // onSubmit (not passed as form action), or isPending and React dev warnings break.
    startTransition(() => {
      if (isEdit) {
        updateAction(fd);
      } else {
        createAction(fd);
      }
    });
  }

  function handleConfirmSign() {
    if (!isEdit) {
      // Signing is only allowed on persisted notes. The button is disabled
      // in create mode, but we guard here too for defence in depth.
      setSignDialogOpen(false);
      return;
    }
    // Always persist the current form values first — this way edits made
    // after the last "Guardar borrador" end up in the signed note instead of
    // being silently dropped. The follow-up signAction fires from the
    // effect above once updateState resolves.
    setSignDialogOpen(false);
    signAfterUpdate.current = true;
    draft.markSubmitting();
    startTransition(() => {
      updateAction(buildFormData());
    });
  }

  // Hide the "Borrador guardado" banner while a save-then-sign is mid-flight
  // (otherwise it flashes for one render between the save completing and the
  // sign action picking up `isSigning`).
  const showDraftSuccess =
    state?.success && !isSigning && !signSucceeded && !signAfterUpdate.current;

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSaveDraft();
        }}
        className="space-y-5"
      >
        {/* Offer to restore a locally-saved draft (never auto-loaded). */}
        {draft.pendingDraft && (
          <DraftRestoreBanner
            savedAt={draft.pendingDraft.savedAt}
            onRestore={draft.restore}
            onDiscard={draft.discard}
          />
        )}

        {/* Status banners */}
        {state && !state.success && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-600/20 bg-red-100/70 backdrop-blur-md px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{state.error}</p>
          </div>
        )}
        {signState && !signState.success && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-600/20 bg-red-100/70 backdrop-blur-md px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{signState.error}</p>
          </div>
        )}
        {showDraftSuccess && (
          <div className="flex items-start gap-2.5 rounded-lg border border-green-600/20 bg-green-100/70 backdrop-blur-md px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-400">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Borrador guardado correctamente</p>
          </div>
        )}

        {/* ── Header: fecha + diagnóstico ─────────────────────────────────── */}
        <section className="glass-card rounded-[22px] p-5.5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Información general
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="note_date">
                Fecha de la consulta <span className="text-red-500">*</span>
              </Label>
              <input
                id="note_date"
                type="date"
                value={textData.note_date}
                onChange={(e) => setText('note_date', e.target.value)}
                max={todayStr}
                required
                className={fieldClass(!!fieldErrors?.note_date)}
              />
              {fieldErrors?.note_date && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.note_date[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="chief_complaint">Motivo de consulta</Label>
              <div className="flex gap-2">
                <input
                  id="chief_complaint"
                  type="text"
                  value={textData.chief_complaint}
                  onChange={(e) => setText('chief_complaint', e.target.value)}
                  placeholder="Ej: Control ginecológico rutinario"
                  maxLength={1000}
                  className={fieldClass(!!fieldErrors?.chief_complaint)}
                />
                <select
                  aria-label="Motivos de consulta frecuentes"
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) setText('chief_complaint', v);
                  }}
                  className="h-9 max-w-[180px] shrink-0 glass-input rounded-full px-3 text-sm text-slate-600 outline-none"
                >
                  <option value="">Frecuentes…</option>
                  {consultationReasonPhrases.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* ── SOAP ────────────────────────────────────────────────────────── */}
        <section className="glass-card rounded-[22px] p-5.5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Nota SOAP
            </h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Subjetivo · Objetivo · Análisis · Plan
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="subjective">Subjetivo</Label>
              <textarea
                id="subjective"
                value={textData.subjective}
                onChange={(e) => setText('subjective', e.target.value)}
                rows={5}
                maxLength={5000}
                placeholder="Síntomas referidos por la paciente, motivo de consulta, historia del padecimiento actual…"
                className={textareaClass(!!fieldErrors?.subjective)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="objective">Objetivo</Label>
              <textarea
                id="objective"
                value={textData.objective}
                onChange={(e) => setText('objective', e.target.value)}
                rows={5}
                maxLength={5000}
                placeholder="Exploración física, signos vitales, hallazgos de laboratorio/imagen…"
                className={textareaClass(!!fieldErrors?.objective)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assessment">Análisis / Evaluación</Label>
              <textarea
                id="assessment"
                value={textData.assessment}
                onChange={(e) => setText('assessment', e.target.value)}
                rows={5}
                maxLength={5000}
                placeholder="Impresión diagnóstica, diagnósticos diferenciales, interpretación clínica…"
                className={textareaClass(!!fieldErrors?.assessment)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan">Plan</Label>
              <textarea
                id="plan"
                value={textData.plan}
                onChange={(e) => setText('plan', e.target.value)}
                rows={5}
                maxLength={5000}
                placeholder="Estudios solicitados, tratamiento, recomendaciones, próximo control…"
                className={textareaClass(!!fieldErrors?.plan)}
              />
            </div>
          </div>
        </section>

        {/* ── Diagnóstico ─────────────────────────────────────────────────── */}
        <section className="glass-card rounded-[22px] p-5.5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Diagnóstico(s)
            </h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Hasta 5 · CIE-10 o texto libre</p>
          </div>
          <DiagnosisListEditor
            diagnoses={diagnoses}
            onChange={setDiagnoses}
            disabled={isPending}
            maxItems={5}
          />
        </section>

        {/* ── specialty_data — consulta ginecológica ──────────────────────── */}
        <section className="glass-card rounded-[22px] p-5.5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Datos de consulta ginecológica
          </h2>

          <div className="space-y-5">
            {/* Row 1: TA · Peso · Altura · IMC */}
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="sp_bp">TA (mmHg)</Label>
                <input
                  id="sp_bp"
                  type="text"
                  value={specialty.blood_pressure}
                  onChange={(e) => setSpec('blood_pressure', e.target.value)}
                  placeholder="120/80"
                  className={fieldClass(
                    specialty.blood_pressure !== '' &&
                      !bloodPressureRegex.test(specialty.blood_pressure),
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sp_weight">Peso (kg)</Label>
                <input
                  id="sp_weight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  max={500}
                  value={specialty.weight_kg}
                  onChange={(e) => onWeightChange(e.target.value)}
                  placeholder="65.5"
                  className={fieldClass()}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sp_height">Talla (cm)</Label>
                <input
                  id="sp_height"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  max={250}
                  value={specialty.height_cm}
                  onChange={(e) => onHeightChange(e.target.value)}
                  placeholder="164"
                  className={fieldClass()}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sp_bmi">IMC (calculado)</Label>
                <input
                  id="sp_bmi"
                  type="text"
                  value={specialty.bmi}
                  readOnly
                  placeholder="—"
                  className={`${fieldClass()} bg-slate-900/4`}
                  aria-describedby="sp_bmi_hint"
                />
                <p id="sp_bmi_hint" className="text-xs text-zinc-400 dark:text-zinc-500">
                  Se calcula automáticamente desde peso y talla.
                </p>
              </div>
            </div>

            {/* Row 2: FUM · Edad gestacional */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sp_lmp">FUM (fecha última menstruación)</Label>
                <input
                  id="sp_lmp"
                  type="date"
                  value={specialty.last_menstrual_period}
                  onChange={(e) => setSpec('last_menstrual_period', e.target.value)}
                  className={fieldClass()}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sp_gest">Edad gestacional (semanas)</Label>
                <input
                  id="sp_gest"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={45}
                  step="0.1"
                  value={specialty.gestational_age_weeks}
                  onChange={(e) => setSpec('gestational_age_weeks', e.target.value)}
                  placeholder="—"
                  className={fieldClass()}
                />
              </div>
            </div>

            {/* Row 3: hallazgos ecográficos */}
            <div className="space-y-1.5">
              <Label htmlFor="sp_us">Hallazgos ecográficos</Label>
              <textarea
                id="sp_us"
                value={specialty.ultrasound_findings}
                onChange={(e) => setSpec('ultrasound_findings', e.target.value)}
                rows={3}
                placeholder="Descripción de hallazgos en ecografía transvaginal/pélvica…"
                className={textareaClass()}
              />
            </div>

            {/* Row 4: folículos izq/der · endometrio */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sp_fol_l">Conteo folicular izquierdo</Label>
                <input
                  id="sp_fol_l"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={specialty.follicle_count_left}
                  onChange={(e) => setSpec('follicle_count_left', e.target.value)}
                  placeholder="—"
                  className={fieldClass()}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sp_fol_r">Conteo folicular derecho</Label>
                <input
                  id="sp_fol_r"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={specialty.follicle_count_right}
                  onChange={(e) => setSpec('follicle_count_right', e.target.value)}
                  placeholder="—"
                  className={fieldClass()}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sp_endo">Grosor endometrial (mm)</Label>
                <input
                  id="sp_endo"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={50}
                  step="0.1"
                  value={specialty.endometrial_thickness_mm}
                  onChange={(e) => setSpec('endometrial_thickness_mm', e.target.value)}
                  placeholder="—"
                  className={fieldClass()}
                />
              </div>
            </div>

            {/* Row 5: procedimiento */}
            <div className="space-y-1.5">
              <Label htmlFor="sp_proc">Procedimiento realizado</Label>
              <textarea
                id="sp_proc"
                value={specialty.procedure_performed}
                onChange={(e) => setSpec('procedure_performed', e.target.value)}
                rows={3}
                placeholder="Ej: punción folicular, transferencia embrionaria, colposcopia…"
                className={textareaClass()}
              />
            </div>

            {/* Row 6: protocolo */}
            <div className="space-y-1.5">
              <Label htmlFor="sp_tx">Protocolo de tratamiento</Label>
              <textarea
                id="sp_tx"
                value={specialty.treatment_protocol}
                onChange={(e) => setSpec('treatment_protocol', e.target.value)}
                rows={2}
                placeholder="Ej: protocolo antagonista, dosis de FSH, inducción de ovulación…"
                className={textareaClass()}
              />
            </div>
          </div>
        </section>

        {/* ── Examen ginecológico estructurado ─────────────────────────────── */}
        <section className="space-y-3">
          <div className="px-1">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Examen ginecológico
            </h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Hallazgos por bloque anatómico y procedimientos realizados durante la consulta.
            </p>
          </div>
          <GynecologicalExamSection
            value={specialty.gynecological_exam}
            onChange={(next) =>
              setSpecialty((prev) => ({ ...prev, gynecological_exam: next }))
            }
            patientId={patientId}
            noteId={isEdit ? note.id : null}
            disabled={isPending}
          />
        </section>

        {/* ── Ecografía estructurada ──────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="px-1">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Ecografía
            </h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Hallazgos estructurados, imágenes y videos del ecógrafo. El
              módulo obstétrico aparece automáticamente si la edad gestacional
              está registrada.
            </p>
          </div>
          <UltrasoundSection
            value={specialty.ultrasound}
            onChange={(next) =>
              setSpecialty((prev) => ({ ...prev, ultrasound: next }))
            }
            patientId={patientId}
            noteId={isEdit ? note.id : null}
            // Obstetric section is gated on an active pregnancy. The doctor
            // already enters EG in the consulta section above, so we use it
            // as the single source of truth instead of asking again.
            showObstetric={Number(specialty.gestational_age_weeks) > 0}
            initialAttachmentsMeta={
              ultrasoundAttachments
                ? Object.fromEntries(ultrasoundAttachments.map((a) => [a.id, a]))
                : {}
            }
            disabled={isPending}
          />
        </section>

        {/* ── internal_notes ──────────────────────────────────────────────── */}
        <section className="rounded-xl border border-amber-600/20 bg-amber-100/70 backdrop-blur-md/40 p-5 dark:border-amber-900/40 dark:bg-amber-950/10">
          <div className="mb-3 flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Notas internas (solo visibles para médicos)
              </h2>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                Este campo no se muestra a recepcionistas. Útil para observaciones
                que no deben ser parte de la nota formal firmada.
              </p>
            </div>
          </div>
          <textarea
            id="internal_notes"
            value={textData.internal_notes}
            onChange={(e) => setText('internal_notes', e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Observaciones internas, notas para el equipo médico…"
            className={textareaClass(!!fieldErrors?.internal_notes)}
          />
        </section>

        {/* ── Acciones ────────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-slate-900/6 bg-white/70 px-4 py-3 backdrop-blur-2xl sm:mx-0 sm:flex-row sm:justify-end">
          <Button type="submit" variant="outline" size="lg" disabled={isPending}>
            {isCreating || isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar borrador
          </Button>

          <Button
            type="button"
            size="lg"
            disabled={isPending || !isEdit}
            title={
              !isEdit
                ? 'Guarda el borrador antes de firmar la nota.'
                : 'Firmar y bloquear la nota'
            }
            onClick={() => setSignDialogOpen(true)}
          >
            <PenLine className="h-4 w-4" />
            Firmar nota
          </Button>
        </div>
      </form>

      {/* Confirmation dialog for sign */}
      {signDialogOpen && (
        <ConfirmSignDialog
          onCancel={() => setSignDialogOpen(false)}
          onConfirm={handleConfirmSign}
          isPending={isSigning}
        />
      )}
    </>
  );
}

// ─── Confirm dialog ──────────────────────────────────────────────────────────
// Small native-feel modal. Using our own overlay (instead of the shadcn
// Sheet) so we can force a centered layout + destructive-style confirmation
// without pulling a separate dialog primitive.

function ConfirmSignDialog({
  onCancel,
  onConfirm,
  isPending,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-[22px] border border-white/60 bg-white/90 p-6 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.4)] backdrop-blur-2xl">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 id="sign-dialog-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Firmar nota de evolución
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Una vez firmada, la nota no se puede editar. ¿Confirmar?
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="lg" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" size="lg" onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PenLine className="h-4 w-4" />
            )}
            Sí, firmar nota
          </Button>
        </div>
      </div>
    </div>
  );
}

