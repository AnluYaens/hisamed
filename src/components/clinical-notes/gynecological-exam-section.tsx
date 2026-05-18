'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  adnexaValues,
  cervixValues,
  dischargeValues,
  douglasValues,
  labiaMajoraValues,
  labiaMinoraValues,
  perinealValues,
  procedureTypeValues,
  uterusPositionValues,
  uterusSizeValues,
  vaginaValues,
  vulvaValues,
  type GynecologicalExam,
  type ProcedureEntry,
  type ProcedureType,
} from '@/lib/validators/clinical-note';
import { ProcedurePhotoSlot } from './procedure-photo-slot';

// ─── Display labels ───────────────────────────────────────────────────────────
// Internal enum strings (snake_case) → user-facing Spanish. Kept colocated
// with the form so the read-only view can re-export them when it renders the
// signed note.

export const LABIA_MAJORA_LABELS: Record<(typeof labiaMajoraValues)[number], string> = {
  normal: 'Normal',
  edema: 'Edema',
  lesiones: 'Lesiones',
  otro: 'Otro',
};

export const LABIA_MINORA_LABELS: Record<(typeof labiaMinoraValues)[number], string> = {
  normal: 'Normal',
  adherencias: 'Adherencias',
  lesiones: 'Lesiones',
  otro: 'Otro',
};

export const VULVA_LABELS: Record<(typeof vulvaValues)[number], string> = {
  normal: 'Normal',
  leucoplasia: 'Leucoplasia',
  condilomas: 'Condilomas',
  otro: 'Otro',
};

export const PERINEAL_LABELS: Record<(typeof perinealValues)[number], string> = {
  normal: 'Normal',
  desgarros: 'Desgarros',
  cicatrices: 'Cicatrices',
  otro: 'Otro',
};

export const VAGINA_LABELS: Record<(typeof vaginaValues)[number], string> = {
  normal: 'Normal',
  leucorrea: 'Leucorrea',
  lesiones: 'Lesiones',
  otro: 'Otro',
};

export const CERVIX_LABELS: Record<(typeof cervixValues)[number], string> = {
  normal: 'Normal',
  ectropion: 'Ectropión',
  polipo: 'Pólipo',
  lesion_sospechosa: 'Lesión sospechosa',
  otro: 'Otro',
};

export const DISCHARGE_LABELS: Record<(typeof dischargeValues)[number], string> = {
  sin_secrecion: 'Sin secreción',
  blanca: 'Blanca',
  amarilla: 'Amarilla',
  verdosa: 'Verdosa',
  sanguinolenta: 'Sanguinolenta',
};

export const UTERUS_SIZE_LABELS: Record<(typeof uterusSizeValues)[number], string> = {
  normal: 'Normal',
  aumentado: 'Aumentado',
  disminuido: 'Disminuido',
};

export const UTERUS_POSITION_LABELS: Record<(typeof uterusPositionValues)[number], string> = {
  avf: 'AVF (anteversoflexión)',
  rvf: 'RVF (retroversoflexión)',
  lateral: 'Lateral',
};

export const ADNEXA_LABELS: Record<(typeof adnexaValues)[number], string> = {
  normal: 'Normal',
  masa_palpable: 'Masa palpable',
  dolor: 'Dolor',
};

export const DOUGLAS_LABELS: Record<(typeof douglasValues)[number], string> = {
  libre: 'Libre',
  abombado: 'Abombado',
  doloroso: 'Doloroso',
};

export const PROCEDURE_LABELS: Record<ProcedureType, string> = {
  citologia: 'Citología',
  cultivo_vaginal: 'Cultivo vaginal',
  biopsia_cuello: 'Biopsia de cuello',
  biopsia_vulva: 'Biopsia de vulva',
  radiocirugia: 'Radiocirugía',
  laser: 'Láser',
  hifu: 'HIFU',
  exosoma: 'Exosoma',
  colocacion_hilos: 'Colocación de hilos',
  otro: 'Otro',
};

// ─── Small UI primitives ──────────────────────────────────────────────────────

function selectClass(): string {
  return [
    'glass-input h-9 w-full rounded-[14px] px-3 text-sm text-slate-900 outline-none',
    'disabled:cursor-not-allowed disabled:opacity-60',
  ].join(' ');
}

function inputClass(): string {
  return [
    'glass-input h-9 w-full rounded-[14px] px-3.5 text-sm text-slate-900 outline-none',
    'placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60',
  ].join(' ');
}

function textareaClass(): string {
  return [
    'glass-input w-full resize-y rounded-[14px] px-3.5 py-2 text-sm text-slate-900 outline-none',
    'placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60',
  ].join(' ');
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-xs font-semibold text-slate-700">
      {children}
    </span>
  );
}

interface FindingFieldProps<V extends string> {
  label: string;
  values: readonly V[];
  labels: Record<V, string>;
  value: V | null | undefined;
  note: string | null | undefined;
  notePlaceholder?: string;
  disabled?: boolean;
  onValueChange: (next: V | null) => void;
  onNoteChange: (next: string) => void;
}

function FindingField<V extends string>({
  label,
  values,
  labels,
  value,
  note,
  notePlaceholder,
  disabled,
  onValueChange,
  onNoteChange,
}: FindingFieldProps<V>) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
        <select
          value={value ?? ''}
          onChange={(e) => onValueChange((e.target.value || null) as V | null)}
          disabled={disabled}
          className={selectClass()}
        >
          <option value="">—</option>
          {values.map((v) => (
            <option key={v} value={v}>
              {labels[v]}
            </option>
          ))}
        </select>
        <input
          type="text"
          maxLength={500}
          value={note ?? ''}
          onChange={(e) => onNoteChange(e.target.value)}
          disabled={disabled}
          placeholder={notePlaceholder ?? 'Detalles…'}
          className={inputClass()}
        />
      </div>
    </div>
  );
}

// ─── Section card with collapse ───────────────────────────────────────────────

function CollapsibleCard({
  title,
  description,
  defaultOpen = true,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="glass-card rounded-[20px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-t-[20px] px-5 py-4 text-left transition-colors hover:bg-teal-600/4"
        aria-expanded={open}
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-slate-400">{description}</p>
          )}
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && <div className="border-t border-slate-900/6 px-5 py-4">{children}</div>}
    </section>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface GynecologicalExamSectionProps {
  value: GynecologicalExam;
  onChange: (next: GynecologicalExam) => void;
  /** Patient id for photo uploads. */
  patientId: string;
  /**
   * Note id (only set in edit mode). Without it, photo uploads are disabled
   * and we show a hint asking the doctor to save the draft first — the
   * upload endpoint requires the note to exist so the attachment can be
   * linked via clinical_note_id.
   */
  noteId: string | null;
  disabled?: boolean;
}

export function GynecologicalExamSection({
  value,
  onChange,
  patientId,
  noteId,
  disabled,
}: GynecologicalExamSectionProps) {
  function patchFinding<K extends keyof GynecologicalExam>(
    key: K,
    patch: Partial<NonNullable<GynecologicalExam[K]>>,
  ) {
    const current = (value[key] ?? {}) as Record<string, unknown>;
    onChange({ ...value, [key]: { ...current, ...patch } as GynecologicalExam[K] });
  }

  // Procedures: the doctor selects which procedures were performed via
  // checkboxes; per-procedure entries hold notes and (optionally) before/after
  // photo attachment ids. We preserve order so the form renders deterministically.
  const procedures: ProcedureEntry[] = value.procedures ?? [];
  const procedureMap = new Map(procedures.map((p) => [p.type, p]));

  function toggleProcedure(type: ProcedureType, checked: boolean) {
    if (checked) {
      if (procedureMap.has(type)) return;
      const next: ProcedureEntry[] = [...procedures, { type }];
      onChange({ ...value, procedures: next });
    } else {
      const next = procedures.filter((p) => p.type !== type);
      onChange({ ...value, procedures: next });
    }
  }

  function patchProcedure(type: ProcedureType, patch: Partial<ProcedureEntry>) {
    const next = procedures.map((p) => (p.type === type ? { ...p, ...patch } : p));
    onChange({ ...value, procedures: next });
  }

  return (
    <div className="space-y-3">
      {/* External */}
      <CollapsibleCard
        title="Examen externo"
        description="Inspección de labios mayores, menores, vulva y región perineal."
      >
        <div className="space-y-4">
          <FindingField
            label="Labios mayores"
            values={labiaMajoraValues}
            labels={LABIA_MAJORA_LABELS}
            value={value.labia_majora?.value ?? null}
            note={value.labia_majora?.note ?? ''}
            disabled={disabled}
            onValueChange={(v) => patchFinding('labia_majora', { value: v })}
            onNoteChange={(n) => patchFinding('labia_majora', { note: n })}
          />
          <FindingField
            label="Labios menores"
            values={labiaMinoraValues}
            labels={LABIA_MINORA_LABELS}
            value={value.labia_minora?.value ?? null}
            note={value.labia_minora?.note ?? ''}
            disabled={disabled}
            onValueChange={(v) => patchFinding('labia_minora', { value: v })}
            onNoteChange={(n) => patchFinding('labia_minora', { note: n })}
          />
          <FindingField
            label="Vulva"
            values={vulvaValues}
            labels={VULVA_LABELS}
            value={value.vulva?.value ?? null}
            note={value.vulva?.note ?? ''}
            disabled={disabled}
            onValueChange={(v) => patchFinding('vulva', { value: v })}
            onNoteChange={(n) => patchFinding('vulva', { note: n })}
          />
          <FindingField
            label="Región perineal"
            values={perinealValues}
            labels={PERINEAL_LABELS}
            value={value.perineal?.value ?? null}
            note={value.perineal?.note ?? ''}
            disabled={disabled}
            onValueChange={(v) => patchFinding('perineal', { value: v })}
            onNoteChange={(n) => patchFinding('perineal', { note: n })}
          />
        </div>
      </CollapsibleCard>

      {/* Speculum */}
      <CollapsibleCard
        title="Examen con espéculo"
        description="Vagina, cuello uterino y características de la secreción."
      >
        <div className="space-y-4">
          <FindingField
            label="Vagina"
            values={vaginaValues}
            labels={VAGINA_LABELS}
            value={value.vagina?.value ?? null}
            note={value.vagina?.note ?? ''}
            disabled={disabled}
            onValueChange={(v) => patchFinding('vagina', { value: v })}
            onNoteChange={(n) => patchFinding('vagina', { note: n })}
          />
          <FindingField
            label="Cuello uterino"
            values={cervixValues}
            labels={CERVIX_LABELS}
            value={value.cervix?.value ?? null}
            note={value.cervix?.note ?? ''}
            disabled={disabled}
            onValueChange={(v) => patchFinding('cervix', { value: v })}
            onNoteChange={(n) => patchFinding('cervix', { note: n })}
          />
          <FindingField
            label="Secreción"
            values={dischargeValues}
            labels={DISCHARGE_LABELS}
            value={value.discharge?.value ?? null}
            note={value.discharge?.note ?? ''}
            disabled={disabled}
            onValueChange={(v) => patchFinding('discharge', { value: v })}
            onNoteChange={(n) => patchFinding('discharge', { note: n })}
          />
        </div>
      </CollapsibleCard>

      {/* Bimanual */}
      <CollapsibleCard
        title="Tacto bimanual"
        description="Útero, anexos y fondo de saco de Douglas."
      >
        <div className="space-y-5">
          {/* Uterus group */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Útero
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Tamaño</FieldLabel>
                <select
                  value={value.uterus?.size ?? ''}
                  onChange={(e) =>
                    patchFinding('uterus', {
                      size: (e.target.value || null) as
                        | (typeof uterusSizeValues)[number]
                        | null,
                    })
                  }
                  disabled={disabled}
                  className={selectClass()}
                >
                  <option value="">—</option>
                  {uterusSizeValues.map((v) => (
                    <option key={v} value={v}>
                      {UTERUS_SIZE_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Posición</FieldLabel>
                <select
                  value={value.uterus?.position ?? ''}
                  onChange={(e) =>
                    patchFinding('uterus', {
                      position: (e.target.value || null) as
                        | (typeof uterusPositionValues)[number]
                        | null,
                    })
                  }
                  disabled={disabled}
                  className={selectClass()}
                >
                  <option value="">—</option>
                  {uterusPositionValues.map((v) => (
                    <option key={v} value={v}>
                      {UTERUS_POSITION_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Consistencia</FieldLabel>
                <input
                  type="text"
                  maxLength={200}
                  value={value.uterus?.consistency ?? ''}
                  onChange={(e) => patchFinding('uterus', { consistency: e.target.value })}
                  disabled={disabled}
                  placeholder="Ej: firme, blando…"
                  className={inputClass()}
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Movilidad</FieldLabel>
                <input
                  type="text"
                  maxLength={200}
                  value={value.uterus?.mobility ?? ''}
                  onChange={(e) => patchFinding('uterus', { mobility: e.target.value })}
                  disabled={disabled}
                  placeholder="Ej: conservada, limitada…"
                  className={inputClass()}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel>Dolor</FieldLabel>
                <input
                  type="text"
                  maxLength={200}
                  value={value.uterus?.pain ?? ''}
                  onChange={(e) => patchFinding('uterus', { pain: e.target.value })}
                  disabled={disabled}
                  placeholder="Sin dolor / dolor a la movilización…"
                  className={inputClass()}
                />
              </div>
            </div>
          </div>

          <FindingField
            label="Anexo derecho"
            values={adnexaValues}
            labels={ADNEXA_LABELS}
            value={value.right_adnexa?.value ?? null}
            note={value.right_adnexa?.note ?? ''}
            disabled={disabled}
            onValueChange={(v) => patchFinding('right_adnexa', { value: v })}
            onNoteChange={(n) => patchFinding('right_adnexa', { note: n })}
          />
          <FindingField
            label="Anexo izquierdo"
            values={adnexaValues}
            labels={ADNEXA_LABELS}
            value={value.left_adnexa?.value ?? null}
            note={value.left_adnexa?.note ?? ''}
            disabled={disabled}
            onValueChange={(v) => patchFinding('left_adnexa', { value: v })}
            onNoteChange={(n) => patchFinding('left_adnexa', { note: n })}
          />
          <FindingField
            label="Fondo de saco de Douglas"
            values={douglasValues}
            labels={DOUGLAS_LABELS}
            value={value.douglas_pouch?.value ?? null}
            note={value.douglas_pouch?.note ?? ''}
            disabled={disabled}
            onValueChange={(v) => patchFinding('douglas_pouch', { value: v })}
            onNoteChange={(n) => patchFinding('douglas_pouch', { note: n })}
          />
        </div>
      </CollapsibleCard>

      {/* Procedures */}
      <CollapsibleCard
        title="Procedimientos realizados"
        description="Marca los procedimientos efectuados en esta consulta y adjunta fotos antes/después si aplica."
      >
        {!noteId && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            Para adjuntar fotos antes/después, primero guarda el borrador. Las fotos se
            asocian a la nota.
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {procedureTypeValues.map((t) => {
            const checked = procedureMap.has(t);
            return (
              <label
                key={t}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-900/8 bg-white/70 px-3 py-2 text-sm transition-colors hover:bg-white has-checked:border-teal-400 has-checked:bg-teal-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggleProcedure(t, e.target.checked)}
                  disabled={disabled}
                  className="h-4 w-4 accent-teal-600"
                />
                <span className="text-zinc-800 dark:text-zinc-200">
                  {PROCEDURE_LABELS[t]}
                </span>
              </label>
            );
          })}
        </div>

        {procedures.length > 0 && (
          <div className="mt-5 space-y-4">
            {procedures.map((p) => (
              <div
                key={p.type}
                className="rounded-2xl border border-slate-900/6 bg-slate-50/60 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {PROCEDURE_LABELS[p.type]}
                    {p.type === 'otro' && p.custom_label ? ` · ${p.custom_label}` : null}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleProcedure(p.type, false)}
                    disabled={disabled}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                  >
                    Quitar
                  </button>
                </div>

                {p.type === 'otro' && (
                  <div className="mb-3 space-y-1.5">
                    <FieldLabel>Nombre del procedimiento</FieldLabel>
                    <input
                      type="text"
                      maxLength={120}
                      value={p.custom_label ?? ''}
                      onChange={(e) =>
                        patchProcedure(p.type, { custom_label: e.target.value })
                      }
                      disabled={disabled}
                      placeholder="Ej: drenaje de absceso de Bartolino"
                      className={inputClass()}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <FieldLabel>Notas del procedimiento</FieldLabel>
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={p.notes ?? ''}
                    onChange={(e) => patchProcedure(p.type, { notes: e.target.value })}
                    disabled={disabled}
                    placeholder="Hallazgos, técnica, muestras tomadas…"
                    className={textareaClass()}
                  />
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <ProcedurePhotoSlot
                    label="Foto antes"
                    patientId={patientId}
                    clinicalNoteId={noteId}
                    procedureType={p.type}
                    photoType="before"
                    attachmentId={p.photos?.before ?? null}
                    disabled={disabled}
                    onChange={(attachmentId: string | null) =>
                      patchProcedure(p.type, {
                        photos: { ...(p.photos ?? {}), before: attachmentId },
                      })
                    }
                  />
                  <ProcedurePhotoSlot
                    label="Foto después"
                    patientId={patientId}
                    clinicalNoteId={noteId}
                    procedureType={p.type}
                    photoType="after"
                    attachmentId={p.photos?.after ?? null}
                    disabled={disabled}
                    onChange={(attachmentId: string | null) =>
                      patchProcedure(p.type, {
                        photos: { ...(p.photos ?? {}), after: attachmentId },
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleCard>
    </div>
  );
}
