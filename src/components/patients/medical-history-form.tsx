'use client';

import { useActionState, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { updateMedicalHistory, type MedicalHistoryActionState } from '@/actions/medical-history';
import type { MedicalHistoryRow } from '@/queries/medical-history';
import type { GynecologyData } from '@/lib/validators/medical-history';
import {
  allergyPhrases,
  familyHistoryPhrases,
  medicationPhrases,
  personalHistoryPhrases,
  surgicalHistoryPhrases,
  type PhraseList,
} from '@/lib/constants/medical-phrases';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fieldClass(hasError = false) {
  return [
    'flex h-9 w-full rounded-lg border bg-white px-3 text-sm shadow-sm outline-none transition-colors',
    'placeholder:text-zinc-400 focus:ring-2',
    'dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500',
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700'
      : 'border-zinc-200 focus:border-teal-600 focus:ring-teal-600/20 dark:border-zinc-700 dark:focus:border-teal-600',
  ].join(' ');
}

function textareaClass(hasError = false) {
  return [
    'w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors resize-none',
    'placeholder:text-zinc-400 focus:ring-2',
    'dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500',
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700'
      : 'border-zinc-200 focus:border-teal-600 focus:ring-teal-600/20 dark:border-zinc-700 dark:focus:border-teal-600',
  ].join(' ');
}

function selectClass() {
  return [
    'flex h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none transition-colors',
    'focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20',
    'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-teal-600',
  ].join(' ');
}

function numFieldClass() {
  return [
    'h-9 w-16 rounded-lg border border-zinc-200 bg-white px-2 text-center text-sm shadow-sm outline-none transition-colors',
    'focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20',
    'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
  ].join(' ');
}

// ─── Collapsible section ──────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  hasContent?: boolean;
}

function Section({ title, defaultOpen = false, children, hasContent = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="glass-card rounded-[22px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</span>
          {hasContent && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              Con datos
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-5 pb-5 pt-4 dark:border-zinc-800">
          {children}
        </div>
      )}
    </div>
  );
}

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
    >
      {children}
    </label>
  );
}

// ─── Phrase picker ────────────────────────────────────────────────────────────
// Appends the chosen phrase to an existing textarea value. Doctors keep
// writing freely; the picker just saves them from typing the boilerplate.
//
// Append rules:
//   - empty value      → phrase
//   - already present  → no-op (avoids duplicate "Penicilina, Penicilina")
//   - otherwise        → existing + ", " + phrase
//
// "Already present" matches whole tokens (split on comma / newline) so
// "Asma" doesn't shadow "Asma severa".

function appendPhrase(current: string, phrase: string): string {
  const trimmed = current.trim();
  if (trimmed === '') return phrase;
  const tokens = trimmed
    .split(/[,\n]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.includes(phrase.toLowerCase())) return current;
  // Preserve trailing whitespace style: if user ends with newline, keep one.
  if (/\n\s*$/.test(current)) return current + phrase;
  return trimmed + ', ' + phrase;
}

function PhrasePicker({
  phrases,
  onPick,
  label = 'Agregar frase frecuente',
}: {
  phrases: PhraseList;
  onPick: (phrase: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={label}
            title={label}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Frase frecuente</span>
          </button>
        }
      />
      <PopoverContent align="end" sideOffset={6} className="w-64 p-1.5">
        <div className="flex flex-col">
          {phrases.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => {
                onPick(phrase);
                setOpen(false);
              }}
              className="rounded-md px-2 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
            >
              {phrase}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Obstetric-formula natural-language summary ────────────────────────────────
// e.g. (3, 1, 1, 1, 0, 1) → "Gesta 3, Para 1, Cesárea 1, Aborto 1 — 1 hijo vivo".
// Skips zero-valued slots so the summary stays readable; only renders when at
// least one slot is set.

function obstetricSummary(g: GynecologyData): string | null {
  const parts: string[] = [];
  const push = (val: number | null | undefined, singular: string, plural: string) => {
    if (val == null || val <= 0) return;
    parts.push(`${singular === plural || val === 1 ? singular : plural} ${val}`);
  };
  push(g.gravida, 'Gesta', 'Gestas');
  push(g.para, 'Para', 'Paras');
  push(g.cesarean, 'Cesárea', 'Cesáreas');
  push(g.abortions, 'Aborto', 'Abortos');
  push(g.ectopic, 'Ectópico', 'Ectópicos');
  if (parts.length === 0 && (g.living_children == null || g.living_children <= 0)) {
    return null;
  }
  let summary = parts.join(', ');
  if (g.living_children != null && g.living_children > 0) {
    const word = g.living_children === 1 ? 'hijo vivo' : 'hijos vivos';
    summary = summary
      ? `${summary} — ${g.living_children} ${word}`
      : `${g.living_children} ${word}`;
  }
  return summary;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface MedicalHistoryFormProps {
  patientId: string;
  history: MedicalHistoryRow | null;
}

// Build the controlled form state from a server snapshot. Extracted so the
// initial render and the post-revalidation re-sync use exactly the same
// normalization rules.

interface TextFields {
  personalHistory: string;
  familyHistory: string;
  surgicalHistory: string;
  allergies: string;
  currentMedications: string;
  habits: string;
}

function buildTextState(h: MedicalHistoryRow | null): TextFields {
  return {
    personalHistory: h?.personalHistory ?? '',
    familyHistory: h?.familyHistory ?? '',
    surgicalHistory: h?.surgicalHistory ?? '',
    allergies: h?.allergies ?? '',
    currentMedications: h?.currentMedications ?? '',
    habits: h?.habits ?? '',
  };
}

function buildGynState(g: GynecologyData): GynecologyData {
  return {
    menarche_age: g.menarche_age ?? null,
    cycle_length_days: g.cycle_length_days ?? null,
    cycle_regularity: g.cycle_regularity ?? null,
    last_menstrual_period: g.last_menstrual_period ?? null,
    contraceptive_method: g.contraceptive_method ?? null,
    pap_smear_last: g.pap_smear_last ?? null,
    mammography_last: g.mammography_last ?? null,
    gravida: g.gravida ?? null,
    para: g.para ?? null,
    cesarean: g.cesarean ?? null,
    abortions: g.abortions ?? null,
    ectopic: g.ectopic ?? null,
    living_children: g.living_children ?? null,
    obstetric_notes: g.obstetric_notes ?? '',
    pregnancy_ended: g.pregnancy_ended ?? null,
    pregnancy_ended_date: g.pregnancy_ended_date ?? null,
  };
}

export function MedicalHistoryForm({ patientId, history }: MedicalHistoryFormProps) {
  const [state, formAction, isPending] = useActionState<MedicalHistoryActionState, FormData>(
    updateMedicalHistory,
    null,
  );

  const gyn: GynecologyData = (history?.specialtyData as GynecologyData) ?? {};

  // Controlled state. Both the text fields and the gynecology JSONB data are
  // tracked locally so that:
  //   1. Users can edit and we can serialize on submit.
  //   2. After a successful save we can re-sync from the canonical server
  //      snapshot (covers concurrent edits and any future server-side
  //      normalization that might rewrite values).
  const [textData, setTextData] = useState<TextFields>(() => buildTextState(history));
  const [gynData, setGynData] = useState<GynecologyData>(() => buildGynState(gyn));

  // Re-sync both states with the server snapshot whenever the underlying
  // record actually changes (i.e. after a successful save → `revalidatePath`
  // updates the prop and bumps `updated_at`). Using `updated_at` as the key
  // prevents accidental clobbering of in-flight user input from unrelated
  // re-renders. This is the React-recommended "adjusting state when a prop
  // changes" pattern (https://react.dev/learn/you-might-not-need-an-effect).
  const recordKey = history?.updatedAt?.toISOString() ?? 'unsaved';
  const [lastSyncedKey, setLastSyncedKey] = useState(recordKey);
  if (lastSyncedKey !== recordKey) {
    setLastSyncedKey(recordKey);
    setTextData(buildTextState(history));
    setGynData(buildGynState(gyn));
  }

  function setTextField<K extends keyof TextFields>(key: K, value: string) {
    setTextData((prev) => ({ ...prev, [key]: value }));
  }

  function setGynField<K extends keyof GynecologyData>(key: K, value: GynecologyData[K]) {
    setGynData((prev) => ({ ...prev, [key]: value }));
  }

  function parseNullableInt(val: string): number | null {
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
  }

  // Reflect live form state, not the initial server snapshot, so the badge
  // updates as the user fills in fields (without needing a save + reload).
  const hasGynData = Object.values(gynData).some(
    (v) => v !== null && v !== undefined && v !== '',
  );

  function handleSubmit(formData: FormData) {
    formData.set('specialty_data', JSON.stringify(gynData));
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <input type="hidden" name="patient_id" value={patientId} />

      {/* Status banners */}
      {state && !state.success && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}
      {state?.success && (
        <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Historia clínica actualizada correctamente</p>
        </div>
      )}

      {/* ── Antecedentes personales ─────────────────────────────────────────── */}
      <Section
        title="Antecedentes personales"
        defaultOpen={!!history?.personalHistory}
        hasContent={textData.personalHistory.length > 0}
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="personal_history">Antecedentes personales patológicos</Label>
            <PhrasePicker
              phrases={personalHistoryPhrases}
              onPick={(p) =>
                setTextField('personalHistory', appendPhrase(textData.personalHistory, p))
              }
            />
          </div>
          <textarea
            id="personal_history"
            name="personal_history"
            value={textData.personalHistory}
            onChange={(e) => setTextField('personalHistory', e.target.value)}
            rows={4}
            placeholder="Enfermedades crónicas, hospitalizaciones previas, condiciones relevantes…"
            className={textareaClass()}
          />
        </div>
      </Section>

      {/* ── Antecedentes familiares ─────────────────────────────────────────── */}
      <Section
        title="Antecedentes familiares"
        defaultOpen={!!history?.familyHistory}
        hasContent={textData.familyHistory.length > 0}
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="family_history">Antecedentes familiares relevantes</Label>
            <PhrasePicker
              phrases={familyHistoryPhrases}
              onPick={(p) =>
                setTextField('familyHistory', appendPhrase(textData.familyHistory, p))
              }
            />
          </div>
          <textarea
            id="family_history"
            name="family_history"
            value={textData.familyHistory}
            onChange={(e) => setTextField('familyHistory', e.target.value)}
            rows={4}
            placeholder="Diabetes, hipertensión, cáncer, enfermedades hereditarias…"
            className={textareaClass()}
          />
        </div>
      </Section>

      {/* ── Antecedentes quirúrgicos ────────────────────────────────────────── */}
      <Section
        title="Antecedentes quirúrgicos"
        defaultOpen={!!history?.surgicalHistory}
        hasContent={textData.surgicalHistory.length > 0}
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="surgical_history">Cirugías y procedimientos previos</Label>
            <PhrasePicker
              phrases={surgicalHistoryPhrases}
              onPick={(p) =>
                setTextField('surgicalHistory', appendPhrase(textData.surgicalHistory, p))
              }
            />
          </div>
          <textarea
            id="surgical_history"
            name="surgical_history"
            value={textData.surgicalHistory}
            onChange={(e) => setTextField('surgicalHistory', e.target.value)}
            rows={4}
            placeholder="Tipo de cirugía, fecha aproximada, complicaciones…"
            className={textareaClass()}
          />
        </div>
      </Section>

      {/* ── Alergias ────────────────────────────────────────────────────────── */}
      <Section
        title="Alergias"
        defaultOpen={!!history?.allergies}
        hasContent={textData.allergies.length > 0}
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="allergies">Alergias conocidas</Label>
            <PhrasePicker
              phrases={allergyPhrases}
              onPick={(p) => setTextField('allergies', appendPhrase(textData.allergies, p))}
            />
          </div>
          <textarea
            id="allergies"
            name="allergies"
            value={textData.allergies}
            onChange={(e) => setTextField('allergies', e.target.value)}
            rows={3}
            placeholder="Medicamentos, alimentos, látex, otras sustancias…"
            className={textareaClass()}
          />
        </div>
      </Section>

      {/* ── Medicación actual ───────────────────────────────────────────────── */}
      <Section
        title="Medicación actual"
        defaultOpen={!!history?.currentMedications}
        hasContent={textData.currentMedications.length > 0}
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="current_medications">Medicamentos en uso</Label>
            <PhrasePicker
              phrases={medicationPhrases}
              onPick={(p) =>
                setTextField('currentMedications', appendPhrase(textData.currentMedications, p))
              }
            />
          </div>
          <textarea
            id="current_medications"
            name="current_medications"
            value={textData.currentMedications}
            onChange={(e) => setTextField('currentMedications', e.target.value)}
            rows={4}
            placeholder="Medicamento, dosis, frecuencia…"
            className={textareaClass()}
          />
        </div>
      </Section>

      {/* ── Hábitos ─────────────────────────────────────────────────────────── */}
      <Section
        title="Hábitos"
        defaultOpen={!!history?.habits}
        hasContent={textData.habits.length > 0}
      >
        <div className="space-y-1.5">
          <Label htmlFor="habits">Hábitos de vida</Label>
          <textarea
            id="habits"
            name="habits"
            value={textData.habits}
            onChange={(e) => setTextField('habits', e.target.value)}
            rows={3}
            placeholder="Tabaquismo, alcohol, actividad física, alimentación…"
            className={textareaClass()}
          />
        </div>
      </Section>

      {/* ── Antecedentes ginecológicos ──────────────────────────────────────── */}
      <Section
        title="Antecedentes ginecológicos y obstétricos"
        defaultOpen={hasGynData}
        hasContent={hasGynData}
      >
        <div className="space-y-5">
          {/* Row 1: Menarquía + Ciclo + Regularidad */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="gyn_menarche_age">Menarquía (edad)</Label>
              <input
                id="gyn_menarche_age"
                type="number"
                min={1}
                max={30}
                value={gynData.menarche_age ?? ''}
                onChange={(e) => setGynField('menarche_age', parseNullableInt(e.target.value))}
                placeholder="12"
                className={fieldClass()}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gyn_cycle_length">Duración del ciclo (días)</Label>
              <input
                id="gyn_cycle_length"
                type="number"
                min={1}
                max={90}
                value={gynData.cycle_length_days ?? ''}
                onChange={(e) =>
                  setGynField('cycle_length_days', parseNullableInt(e.target.value))
                }
                placeholder="28"
                className={fieldClass()}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gyn_regularity">Regularidad</Label>
              <select
                id="gyn_regularity"
                value={gynData.cycle_regularity ?? ''}
                onChange={(e) =>
                  setGynField(
                    'cycle_regularity',
                    (e.target.value as GynecologyData['cycle_regularity']) || null,
                  )
                }
                className={selectClass()}
              >
                <option value="">— Seleccionar —</option>
                <option value="regular">Regular</option>
                <option value="irregular">Irregular</option>
                <option value="amenorrhea">Amenorrea</option>
              </select>
            </div>
          </div>

          {/* Row 2: FUM + Método anticonceptivo */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gyn_lmp">FUM — Fecha última menstruación</Label>
              <input
                id="gyn_lmp"
                type="date"
                value={gynData.last_menstrual_period ?? ''}
                onChange={(e) =>
                  setGynField('last_menstrual_period', e.target.value || null)
                }
                className={fieldClass()}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gyn_contraceptive">Método anticonceptivo</Label>
              <select
                id="gyn_contraceptive"
                value={gynData.contraceptive_method ?? ''}
                onChange={(e) =>
                  setGynField(
                    'contraceptive_method',
                    (e.target.value as GynecologyData['contraceptive_method']) || null,
                  )
                }
                className={selectClass()}
              >
                <option value="">— Seleccionar —</option>
                <option value="none">Ninguno</option>
                <option value="oral">Anticonceptivos orales</option>
                <option value="iud">DIU</option>
                <option value="implant">Implante</option>
                <option value="barrier">Barrera (condón, diafragma)</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>

          {/* Fin de embarazo */}
          {gynData.last_menstrual_period && (
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={gynData.pregnancy_ended === true}
                  onChange={(e) =>
                    setGynField('pregnancy_ended', e.target.checked ? true : null)
                  }
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-pink-600"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    Marcar fin de embarazo
                  </span>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Registra que el embarazo actual ha concluido (parto, cesárea, pérdida)
                  </p>
                  {gynData.pregnancy_ended && (() => {
                    const endDateError =
                      gynData.pregnancy_ended_date &&
                      gynData.last_menstrual_period &&
                      gynData.pregnancy_ended_date < gynData.last_menstrual_period
                        ? 'La fecha de fin de embarazo no puede ser anterior a la FUM'
                        : null;
                    return (
                      <div className="mt-3 space-y-1.5">
                        <Label htmlFor="gyn_pregnancy_ended_date">Fecha de finalización</Label>
                        <input
                          id="gyn_pregnancy_ended_date"
                          type="date"
                          value={gynData.pregnancy_ended_date ?? ''}
                          min={gynData.last_menstrual_period ?? undefined}
                          onChange={(e) =>
                            setGynField('pregnancy_ended_date', e.target.value || null)
                          }
                          className={`${fieldClass(endDateError !== null)} max-w-xs`}
                        />
                        {endDateError && (
                          <p className="text-xs text-red-600 dark:text-red-400">{endDateError}</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </label>
            </div>
          )}

          {/* Row 3: Pap + Mamografía */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gyn_pap">Último Papanicolaou</Label>
              <input
                id="gyn_pap"
                type="month"
                value={gynData.pap_smear_last ?? ''}
                onChange={(e) => setGynField('pap_smear_last', e.target.value || null)}
                className={fieldClass()}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gyn_mammo">Última mamografía</Label>
              <input
                id="gyn_mammo"
                type="month"
                value={gynData.mammography_last ?? ''}
                onChange={(e) => setGynField('mammography_last', e.target.value || null)}
                className={fieldClass()}
              />
            </div>
          </div>

          {/* Fórmula obstétrica */}
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Fórmula obstétrica
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              {(
                [
                  { key: 'gravida', label: 'G' },
                  { key: 'para', label: 'P' },
                  { key: 'cesarean', label: 'C' },
                  { key: 'abortions', label: 'A' },
                  { key: 'ectopic', label: 'E' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                    {label}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={gynData[key] ?? ''}
                    onChange={(e) => setGynField(key, parseNullableInt(e.target.value))}
                    placeholder="0"
                    className={numFieldClass()}
                    aria-label={label}
                  />
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
              G = Gestas · P = Partos · C = Cesáreas · A = Abortos · E = Ectópicos
            </p>
            {(() => {
              const summary = obstetricSummary(gynData);
              if (!summary) return null;
              return (
                <p className="mt-2 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {summary}
                </p>
              );
            })()}
          </div>

          {/* Hijos vivos */}
          <div className="space-y-1.5">
            <Label htmlFor="gyn_living_children">Hijos vivos</Label>
            <input
              id="gyn_living_children"
              type="number"
              min={0}
              value={gynData.living_children ?? ''}
              onChange={(e) =>
                setGynField('living_children', parseNullableInt(e.target.value))
              }
              placeholder="0"
              className={`${fieldClass()} max-w-xs`}
            />
          </div>

          {/* Notas obstétricas */}
          <div className="space-y-1.5">
            <Label htmlFor="gyn_obstetric_notes">Notas obstétricas</Label>
            <textarea
              id="gyn_obstetric_notes"
              value={gynData.obstetric_notes ?? ''}
              onChange={(e) => setGynField('obstetric_notes', e.target.value)}
              rows={3}
              placeholder="Detalles de embarazos, partos, complicaciones…"
              className={textareaClass()}
            />
          </div>
        </div>
      </Section>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Guardar historia clínica
        </Button>
      </div>
    </form>
  );
}
