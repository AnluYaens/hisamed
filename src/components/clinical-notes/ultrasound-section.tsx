'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ChevronDown, ChevronRight, Film, Loader2, Trash2, Upload } from 'lucide-react';
import {
  ALLOWED_ATTACHMENT_MIME,
  isVideoMime,
  maxBytesForMime,
} from '@/lib/validators/attachment';
import {
  bladderUltrasoundValues,
  douglasFluidValues,
  endometriumPatternValues,
  fetalCountValues,
  fetalPresentationValues,
  placentaGradeValues,
  placentaLocationValues,
  uterusUltrasoundPositionValues,
  type GynecologicalUltrasound,
  type ObstetricUltrasound,
  type OvaryUltrasound,
  type Ultrasound,
} from '@/lib/validators/clinical-note';
import {
  gestationalAgeWeeks,
  hadlockEfwGrams,
  ovaryVolumeMl,
} from '@/lib/ultrasound';

// ─── Display labels ───────────────────────────────────────────────────────────

export const UTERUS_US_POSITION_LABELS: Record<
  (typeof uterusUltrasoundPositionValues)[number],
  string
> = {
  avf: 'AVF (anteversoflexión)',
  rvf: 'RVF (retroversoflexión)',
  lateral: 'Lateral',
  no_visualizado: 'No visualizado',
};

export const ENDOMETRIUM_PATTERN_LABELS: Record<
  (typeof endometriumPatternValues)[number],
  string
> = {
  trilaminar: 'Trilaminar',
  homogeneo: 'Homogéneo',
  heterogeneo: 'Heterogéneo',
  no_evaluable: 'No evaluable',
};

export const BLADDER_US_LABELS: Record<(typeof bladderUltrasoundValues)[number], string> = {
  normal: 'Normal',
  distendida: 'Distendida',
  con_contenido: 'Con contenido',
};

export const DOUGLAS_FLUID_LABELS: Record<(typeof douglasFluidValues)[number], string> = {
  ausente: 'Ausente',
  escaso: 'Escaso',
  moderado: 'Moderado',
  abundante: 'Abundante',
};

export const FETAL_COUNT_LABELS: Record<(typeof fetalCountValues)[number], string> = {
  '1': '1',
  '2': '2',
  '3+': '3 o más',
};

export const FETAL_PRESENTATION_LABELS: Record<
  (typeof fetalPresentationValues)[number],
  string
> = {
  cefalica: 'Cefálica',
  podalica: 'Podálica',
  transversa: 'Transversa',
  no_aplica: 'No aplica',
};

export const PLACENTA_LOCATION_LABELS: Record<
  (typeof placentaLocationValues)[number],
  string
> = {
  anterior: 'Anterior',
  posterior: 'Posterior',
  fundica: 'Fúndica',
  previa: 'Previa',
};

export const PLACENTA_GRADE_LABELS: Record<(typeof placentaGradeValues)[number], string> = {
  '0': 'Grado 0',
  I: 'Grado I',
  II: 'Grado II',
  III: 'Grado III',
};

// ─── UI primitives ────────────────────────────────────────────────────────────

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

function readonlyInputClass(): string {
  return `${inputClass()} bg-slate-900/4`;
}

function textareaClass(): string {
  return [
    'glass-input w-full resize-y rounded-[14px] px-3.5 py-2 text-sm text-slate-900 outline-none',
    'placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60',
  ].join(' ');
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
      {children}
    </span>
  );
}

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
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{description}</p>
          )}
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-400" />
        )}
      </button>
      {open && (
        <div className="border-t border-slate-900/6 px-5 py-4">{children}</div>
      )}
    </section>
  );
}

// ─── Ovary subform ────────────────────────────────────────────────────────────

interface OvaryFieldsProps {
  label: string;
  value: OvaryUltrasound;
  disabled?: boolean;
  onChange: (next: OvaryUltrasound) => void;
}

function OvaryFields({ label, value, disabled, onChange }: OvaryFieldsProps) {
  // Recompute the volume whenever any of L, A, AP changes. The persisted
  // value is updated in lockstep so the read view doesn't have to recalc
  // from the (potentially partial) dimensions.
  const computedVolume = ovaryVolumeMl(value.length_mm, value.width_mm, value.ap_mm);

  useEffect(() => {
    if (computedVolume !== (value.volume_ml ?? null)) {
      onChange({ ...value, volume_ml: computedVolume ?? undefined });
    }
    // We intentionally re-run only when the dimensions (or the computed
    // value) change — including `onChange` would loop because the parent
    // passes a fresh closure on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.length_mm, value.width_mm, value.ap_mm, computedVolume]);

  function patch(p: Partial<OvaryUltrasound>) {
    onChange({ ...value, ...p });
  }

  function numField(v: number | null | undefined): string {
    return v == null ? '' : String(v);
  }

  function parseNum(v: string): number | undefined {
    if (v.trim() === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <div className="space-y-1.5">
          <FieldLabel>Longitud (mm)</FieldLabel>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            max={200}
            value={numField(value.length_mm)}
            onChange={(e) => patch({ length_mm: parseNum(e.target.value) })}
            disabled={disabled}
            className={inputClass()}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Ancho (mm)</FieldLabel>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            max={200}
            value={numField(value.width_mm)}
            onChange={(e) => patch({ width_mm: parseNum(e.target.value) })}
            disabled={disabled}
            className={inputClass()}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>AP (mm)</FieldLabel>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            max={200}
            value={numField(value.ap_mm)}
            onChange={(e) => patch({ ap_mm: parseNum(e.target.value) })}
            disabled={disabled}
            className={inputClass()}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Volumen (ml)</FieldLabel>
          <input
            type="text"
            value={value.volume_ml != null ? value.volume_ml.toFixed(2) : ''}
            readOnly
            placeholder="—"
            className={readonlyInputClass()}
            aria-describedby={`ovary-${label}-vol-hint`}
          />
          <p
            id={`ovary-${label}-vol-hint`}
            className="text-[11px] text-zinc-400 dark:text-zinc-500"
          >
            0.523 × L × A × AP
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel>Folículos (número)</FieldLabel>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={numField(value.follicle_count)}
            onChange={(e) => patch({ follicle_count: parseNum(e.target.value) })}
            disabled={disabled}
            className={inputClass()}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Folículo dominante (mm)</FieldLabel>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            max={100}
            value={numField(value.dominant_follicle_mm)}
            onChange={(e) => patch({ dominant_follicle_mm: parseNum(e.target.value) })}
            disabled={disabled}
            className={inputClass()}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Hallazgos</FieldLabel>
        <textarea
          rows={2}
          maxLength={2000}
          value={value.findings ?? ''}
          onChange={(e) => patch({ findings: e.target.value })}
          disabled={disabled}
          placeholder="Quistes, masas, asimetrías…"
          className={textareaClass()}
        />
      </div>
    </div>
  );
}

// ─── Image / video gallery ────────────────────────────────────────────────────

// Subset of the global whitelist that makes sense for ultrasound captures.
// PDFs are excluded because the doctor uploads them through the patient-level
// attachments tab instead; the eco gallery is for raw captures.
const US_ACCEPT = Object.entries(ALLOWED_ATTACHMENT_MIME)
  .filter(([m]) => m.startsWith('image/') || m.startsWith('video/'))
  .map(([m]) => m)
  .join(',');

interface UltrasoundGalleryProps {
  patientId: string;
  clinicalNoteId: string | null;
  attachmentIds: string[];
  attachmentsMeta: Record<string, AttachmentMeta>;
  disabled?: boolean;
  onChange: (nextIds: string[], newlyUploaded?: AttachmentMeta) => void;
}

export interface AttachmentMeta {
  id: string;
  fileName: string;
  fileType: string;
}

function validateClientSide(file: File): string | null {
  if (file.size === 0) return 'El archivo está vacío';
  const mime = file.type?.toLowerCase() ?? '';
  if (!ALLOWED_ATTACHMENT_MIME[mime]) {
    return 'Tipo de archivo no permitido. Solo JPG, PNG, MP4 o MOV.';
  }
  const limit = maxBytesForMime(mime);
  if (file.size > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    return `El archivo excede el tamaño máximo de ${mb}MB`;
  }
  return null;
}

function UltrasoundGallery({
  patientId,
  clinicalNoteId,
  attachmentIds,
  attachmentsMeta,
  disabled,
  onChange,
}: UltrasoundGalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUpload = !disabled && !isUploading && Boolean(clinicalNoteId);

  async function uploadOne(file: File): Promise<AttachmentMeta | null> {
    const err = validateClientSide(file);
    if (err) {
      setError(err);
      return null;
    }
    if (!clinicalNoteId) {
      setError('Guarda el borrador antes de subir imágenes/videos.');
      return null;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('patient_id', patientId);
    fd.append('clinical_note_id', clinicalNoteId);
    fd.append('category', 'ultrasound');
    fd.append('description', 'Captura ecográfica');
    const res = await fetch('/api/attachments/upload', { method: 'POST', body: fd });
    const json = (await res.json().catch(() => null)) as
      | { success: true; data: { id: string; fileName: string; fileType: string } }
      | { success: false; error?: string }
      | null;
    if (!res.ok || !json || json.success === false) {
      const msg = (json && json.success === false && json.error) || `Error ${res.status}`;
      setError(msg);
      return null;
    }
    return {
      id: json.data.id,
      fileName: json.data.fileName,
      fileType: json.data.fileType,
    };
  }

  async function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    setIsUploading(true);
    try {
      // Sequential upload — the API path is single-file and we want any
      // failure to halt the batch so the user notices instead of guessing
      // which ones got through.
      let nextIds = [...attachmentIds];
      let lastMeta: AttachmentMeta | undefined;
      for (const f of files) {
        const meta = await uploadOne(f);
        if (!meta) break;
        nextIds = [...nextIds, meta.id];
        lastMeta = meta;
        onChange(nextIds, meta);
      }
      // Refresh in case the loop was interrupted (so the parent gets the
      // final list state even on partial success).
      if (lastMeta) onChange(nextIds, lastMeta);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function unlink(id: string) {
    onChange(attachmentIds.filter((x) => x !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <FieldLabel>Imágenes y videos del eco</FieldLabel>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            JPG, PNG (hasta 10MB) · MP4, MOV (hasta 50MB).
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canUpload}
          className="glass-input inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold text-slate-700 outline-none transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {clinicalNoteId ? 'Adjuntar imágenes del eco' : 'Guarda el borrador'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={US_ACCEPT}
        multiple
        className="hidden"
        onChange={onInputChange}
      />

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {attachmentIds.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-slate-900/12 bg-slate-50/60 text-xs text-slate-500">
          Sin imágenes adjuntas todavía.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {attachmentIds.map((id) => {
            const meta = attachmentsMeta[id];
            const isVideo = meta ? isVideoMime(meta.fileType) : false;
            return (
              <li
                key={id}
                className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/70"
              >
                {isVideo ? (
                  <div className="relative flex h-32 items-center justify-center bg-slate-900/5 text-slate-500">
                    <Film className="h-8 w-8" />
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      video
                    </span>
                  </div>
                ) : (
                  <a
                    href={`/api/attachments/${id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/attachments/${id}/download`}
                      alt={meta?.fileName ?? 'Captura ecográfica'}
                      className="h-32 w-full object-cover"
                    />
                  </a>
                )}
                <div className="flex items-center justify-between gap-2 border-t border-slate-900/6 px-2 py-1.5">
                  <span
                    className="truncate text-[11px] text-zinc-600 dark:text-zinc-400"
                    title={meta?.fileName ?? id}
                  >
                    {meta?.fileName ?? 'Captura'}
                  </span>
                  <button
                    type="button"
                    onClick={() => unlink(id)}
                    disabled={disabled || isUploading}
                    aria-label="Quitar"
                    className="inline-flex items-center text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Main UltrasoundSection ───────────────────────────────────────────────────

interface UltrasoundSectionProps {
  value: Ultrasound;
  onChange: (next: Ultrasound) => void;
  patientId: string;
  /** Without a noteId, attachment uploads are disabled until the draft saves. */
  noteId: string | null;
  /**
   * Show the obstetric subsection. Driven by the parent based on whether the
   * patient has an active pregnancy (e.g. `gestational_age_weeks > 0`); we
   * don't infer it here so the parent can override (twin/early scan, etc.).
   */
  showObstetric: boolean;
  /**
   * Metadata for already-uploaded ultrasound attachments so we can render the
   * gallery (image vs video, filename). Newly uploaded files are added to a
   * local cache here when they come back from the upload endpoint.
   */
  initialAttachmentsMeta?: Record<string, AttachmentMeta>;
  disabled?: boolean;
}

export function UltrasoundSection({
  value,
  onChange,
  patientId,
  noteId,
  showObstetric,
  initialAttachmentsMeta = {},
  disabled,
}: UltrasoundSectionProps) {
  // Local cache of attachment metadata. Seeded from the server-passed prop;
  // grows as the user uploads new files in this session. Survives only
  // within the form lifetime, which is exactly what we need — once the
  // draft is saved the parent re-fetches and rehydrates `initialAttachmentsMeta`.
  const [metaCache, setMetaCache] = useState<Record<string, AttachmentMeta>>(
    initialAttachmentsMeta,
  );

  // If new metadata flows in from the server (e.g. after a save refresh),
  // merge it on top of any locally-known entries.
  useEffect(() => {
    setMetaCache((prev) => ({ ...initialAttachmentsMeta, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(initialAttachmentsMeta).length]);

  const gyn = value.gynecological ?? {};
  const obs = value.obstetric ?? {};
  const ids = useMemo(() => value.image_attachment_ids ?? [], [value.image_attachment_ids]);

  function patchGyn(p: Partial<GynecologicalUltrasound>) {
    onChange({ ...value, gynecological: { ...gyn, ...p } });
  }

  function patchUterus(p: Partial<NonNullable<GynecologicalUltrasound['uterus']>>) {
    patchGyn({ uterus: { ...(gyn.uterus ?? {}), ...p } });
  }

  function patchBladder(p: Partial<NonNullable<GynecologicalUltrasound['bladder']>>) {
    patchGyn({ bladder: { ...(gyn.bladder ?? {}), ...p } });
  }

  function patchObs(p: Partial<ObstetricUltrasound>) {
    onChange({ ...value, obstetric: { ...obs, ...p } });
  }

  function patchBiometry(p: Partial<NonNullable<ObstetricUltrasound['biometry']>>) {
    const nextBio = { ...(obs.biometry ?? {}), ...p };
    // Recompute EFW + GA from the latest measurements. Keep the persisted
    // value in lockstep with what the doctor sees so the read view doesn't
    // recalc from possibly-partial inputs.
    const efw = hadlockEfwGrams(nextBio.bpd_mm, nextBio.hc_mm, nextBio.ac_mm, nextBio.fl_mm);
    const ga = gestationalAgeWeeks(nextBio.bpd_mm, nextBio.hc_mm, nextBio.ac_mm, nextBio.fl_mm);
    patchObs({
      biometry: {
        ...nextBio,
        estimated_weight_g: efw ?? undefined,
        estimated_ga_weeks: ga ?? undefined,
      },
    });
  }

  function patchAmniotic(p: Partial<NonNullable<ObstetricUltrasound['amniotic_fluid']>>) {
    patchObs({ amniotic_fluid: { ...(obs.amniotic_fluid ?? {}), ...p } });
  }

  function patchPlacenta(p: Partial<NonNullable<ObstetricUltrasound['placenta']>>) {
    patchObs({ placenta: { ...(obs.placenta ?? {}), ...p } });
  }

  function setIds(nextIds: string[], newlyUploaded?: AttachmentMeta) {
    if (newlyUploaded) {
      setMetaCache((prev) => ({ ...prev, [newlyUploaded.id]: newlyUploaded }));
    }
    onChange({ ...value, image_attachment_ids: nextIds });
  }

  function num(v: number | null | undefined): string {
    return v == null ? '' : String(v);
  }

  function parseNum(v: string): number | undefined {
    if (v.trim() === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }

  const uterus = gyn.uterus ?? {};
  const biometry = obs.biometry ?? {};
  const amniotic = obs.amniotic_fluid ?? {};
  const placenta = obs.placenta ?? {};

  return (
    <div className="space-y-3">
      {/* Gynecological ultrasound */}
      <CollapsibleCard
        title="Ecografía ginecológica"
        description="Útero, ovarios, vejiga y fondo de saco de Douglas."
      >
        <div className="space-y-6">
          {/* Útero */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Útero
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Posición</FieldLabel>
                <select
                  value={uterus.position ?? ''}
                  onChange={(e) =>
                    patchUterus({
                      position:
                        (e.target.value || null) as
                          | (typeof uterusUltrasoundPositionValues)[number]
                          | null,
                    })
                  }
                  disabled={disabled}
                  className={selectClass()}
                >
                  <option value="">—</option>
                  {uterusUltrasoundPositionValues.map((v) => (
                    <option key={v} value={v}>
                      {UTERUS_US_POSITION_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Patrón endometrial</FieldLabel>
                <select
                  value={uterus.endometrium_pattern ?? ''}
                  onChange={(e) =>
                    patchUterus({
                      endometrium_pattern:
                        (e.target.value || null) as
                          | (typeof endometriumPatternValues)[number]
                          | null,
                    })
                  }
                  disabled={disabled}
                  className={selectClass()}
                >
                  <option value="">—</option>
                  {endometriumPatternValues.map((v) => (
                    <option key={v} value={v}>
                      {ENDOMETRIUM_PATTERN_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="space-y-1.5">
                <FieldLabel>Longitud (mm)</FieldLabel>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  max={300}
                  value={num(uterus.length_mm)}
                  onChange={(e) => patchUterus({ length_mm: parseNum(e.target.value) })}
                  disabled={disabled}
                  className={inputClass()}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Anteroposterior (mm)</FieldLabel>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  max={300}
                  value={num(uterus.ap_mm)}
                  onChange={(e) => patchUterus({ ap_mm: parseNum(e.target.value) })}
                  disabled={disabled}
                  className={inputClass()}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Transverso (mm)</FieldLabel>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  max={300}
                  value={num(uterus.transverse_mm)}
                  onChange={(e) => patchUterus({ transverse_mm: parseNum(e.target.value) })}
                  disabled={disabled}
                  className={inputClass()}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Endometrio (mm)</FieldLabel>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  max={50}
                  value={num(uterus.endometrium_thickness_mm)}
                  onChange={(e) =>
                    patchUterus({ endometrium_thickness_mm: parseNum(e.target.value) })
                  }
                  disabled={disabled}
                  className={inputClass()}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Hallazgos</FieldLabel>
              <textarea
                rows={2}
                maxLength={2000}
                value={uterus.findings ?? ''}
                onChange={(e) => patchUterus({ findings: e.target.value })}
                disabled={disabled}
                placeholder="Miomas, pólipos, sinequias…"
                className={textareaClass()}
              />
            </div>
          </div>

          {/* Ovaries */}
          <OvaryFields
            label="Ovario derecho"
            value={gyn.right_ovary ?? {}}
            disabled={disabled}
            onChange={(v) => patchGyn({ right_ovary: v })}
          />
          <OvaryFields
            label="Ovario izquierdo"
            value={gyn.left_ovary ?? {}}
            disabled={disabled}
            onChange={(v) => patchGyn({ left_ovary: v })}
          />

          {/* Vejiga */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Vejiga
            </p>
            <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
              <select
                value={gyn.bladder?.value ?? ''}
                onChange={(e) =>
                  patchBladder({
                    value:
                      (e.target.value || null) as
                        | (typeof bladderUltrasoundValues)[number]
                        | null,
                  })
                }
                disabled={disabled}
                className={selectClass()}
              >
                <option value="">—</option>
                {bladderUltrasoundValues.map((v) => (
                  <option key={v} value={v}>
                    {BLADDER_US_LABELS[v]}
                  </option>
                ))}
              </select>
              <textarea
                rows={2}
                maxLength={500}
                value={gyn.bladder?.note ?? ''}
                onChange={(e) => patchBladder({ note: e.target.value })}
                disabled={disabled}
                placeholder="Detalles, contenido…"
                className={textareaClass()}
              />
            </div>
          </div>

          {/* Douglas fluid */}
          <div className="space-y-1.5">
            <FieldLabel>Líquido libre en fondo de saco de Douglas</FieldLabel>
            <select
              value={gyn.douglas_fluid ?? ''}
              onChange={(e) =>
                patchGyn({
                  douglas_fluid:
                    (e.target.value || null) as (typeof douglasFluidValues)[number] | null,
                })
              }
              disabled={disabled}
              className={selectClass()}
            >
              <option value="">—</option>
              {douglasFluidValues.map((v) => (
                <option key={v} value={v}>
                  {DOUGLAS_FLUID_LABELS[v]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CollapsibleCard>

      {/* Obstetric ultrasound — only shown when there is an active pregnancy */}
      {showObstetric && (
        <CollapsibleCard
          title="Ecografía obstétrica"
          description="Visible porque la consulta tiene edad gestacional activa."
        >
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <FieldLabel>Número de fetos</FieldLabel>
                <select
                  value={obs.fetal_count ?? ''}
                  onChange={(e) =>
                    patchObs({
                      fetal_count:
                        (e.target.value || null) as (typeof fetalCountValues)[number] | null,
                    })
                  }
                  disabled={disabled}
                  className={selectClass()}
                >
                  <option value="">—</option>
                  {fetalCountValues.map((v) => (
                    <option key={v} value={v}>
                      {FETAL_COUNT_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Presentación</FieldLabel>
                <select
                  value={obs.presentation ?? ''}
                  onChange={(e) =>
                    patchObs({
                      presentation:
                        (e.target.value || null) as
                          | (typeof fetalPresentationValues)[number]
                          | null,
                    })
                  }
                  disabled={disabled}
                  className={selectClass()}
                >
                  <option value="">—</option>
                  {fetalPresentationValues.map((v) => (
                    <option key={v} value={v}>
                      {FETAL_PRESENTATION_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>FCF (lpm)</FieldLabel>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={300}
                  value={num(obs.fetal_heart_rate)}
                  onChange={(e) => patchObs({ fetal_heart_rate: parseNum(e.target.value) })}
                  disabled={disabled}
                  placeholder="Ej: 145"
                  className={inputClass()}
                />
              </div>
            </div>

            {/* Biometry */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Biometría fetal
              </p>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div className="space-y-1.5">
                  <FieldLabel>DBP (mm)</FieldLabel>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={0}
                    max={200}
                    value={num(biometry.bpd_mm)}
                    onChange={(e) => patchBiometry({ bpd_mm: parseNum(e.target.value) })}
                    disabled={disabled}
                    className={inputClass()}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>CC (mm)</FieldLabel>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={0}
                    max={500}
                    value={num(biometry.hc_mm)}
                    onChange={(e) => patchBiometry({ hc_mm: parseNum(e.target.value) })}
                    disabled={disabled}
                    className={inputClass()}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>CA (mm)</FieldLabel>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={0}
                    max={500}
                    value={num(biometry.ac_mm)}
                    onChange={(e) => patchBiometry({ ac_mm: parseNum(e.target.value) })}
                    disabled={disabled}
                    className={inputClass()}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>LF (mm)</FieldLabel>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={0}
                    max={200}
                    value={num(biometry.fl_mm)}
                    onChange={(e) => patchBiometry({ fl_mm: parseNum(e.target.value) })}
                    disabled={disabled}
                    className={inputClass()}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel>Peso estimado (g) — Hadlock</FieldLabel>
                  <input
                    type="text"
                    value={biometry.estimated_weight_g != null ? String(biometry.estimated_weight_g) : ''}
                    readOnly
                    placeholder="—"
                    className={readonlyInputClass()}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Edad gestacional por biometría (sem)</FieldLabel>
                  <input
                    type="text"
                    value={
                      biometry.estimated_ga_weeks != null
                        ? biometry.estimated_ga_weeks.toFixed(1)
                        : ''
                    }
                    readOnly
                    placeholder="—"
                    className={readonlyInputClass()}
                  />
                </div>
              </div>
            </div>

            {/* Amniotic */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Líquido amniótico
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel>ILA (cm)</FieldLabel>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={0}
                    max={50}
                    value={num(amniotic.afi_cm)}
                    onChange={(e) => patchAmniotic({ afi_cm: parseNum(e.target.value) })}
                    disabled={disabled}
                    className={inputClass()}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Bolsillo mayor (cm)</FieldLabel>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={0}
                    max={50}
                    value={num(amniotic.sdp_cm)}
                    onChange={(e) => patchAmniotic({ sdp_cm: parseNum(e.target.value) })}
                    disabled={disabled}
                    className={inputClass()}
                  />
                </div>
              </div>
            </div>

            {/* Placenta */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Placenta
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel>Localización</FieldLabel>
                  <select
                    value={placenta.location ?? ''}
                    onChange={(e) =>
                      patchPlacenta({
                        location:
                          (e.target.value || null) as
                            | (typeof placentaLocationValues)[number]
                            | null,
                      })
                    }
                    disabled={disabled}
                    className={selectClass()}
                  >
                    <option value="">—</option>
                    {placentaLocationValues.map((v) => (
                      <option key={v} value={v}>
                        {PLACENTA_LOCATION_LABELS[v]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Grado (Grannum)</FieldLabel>
                  <select
                    value={placenta.grade ?? ''}
                    onChange={(e) =>
                      patchPlacenta({
                        grade:
                          (e.target.value || null) as
                            | (typeof placentaGradeValues)[number]
                            | null,
                      })
                    }
                    disabled={disabled}
                    className={selectClass()}
                  >
                    <option value="">—</option>
                    {placentaGradeValues.map((v) => (
                      <option key={v} value={v}>
                        {PLACENTA_GRADE_LABELS[v]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Hallazgos adicionales</FieldLabel>
              <textarea
                rows={3}
                maxLength={4000}
                value={obs.findings ?? ''}
                onChange={(e) => patchObs({ findings: e.target.value })}
                disabled={disabled}
                placeholder="Anatomía fetal, marcadores, observaciones…"
                className={textareaClass()}
              />
            </div>
          </div>
        </CollapsibleCard>
      )}

      {/* Image / video gallery */}
      <CollapsibleCard
        title="Imágenes del eco"
        description="Capturas o videos cortos del ecógrafo (JPG, PNG, MP4, MOV)."
      >
        <UltrasoundGallery
          patientId={patientId}
          clinicalNoteId={noteId}
          attachmentIds={ids}
          attachmentsMeta={metaCache}
          disabled={disabled}
          onChange={setIds}
        />
      </CollapsibleCard>
    </div>
  );
}
