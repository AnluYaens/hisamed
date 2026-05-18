'use client';

import { startTransition, useActionState, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Activity, CheckCircle2, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  createVitalSigns,
  type VitalSignsActionState,
} from '@/actions/vital-signs';

// ─── Severity model ───────────────────────────────────────────────────────────
// Three buckets: ok (no styling), warn (yellow), alert (red). Thresholds taken
// from the prompt — they're not full clinical guidelines, just visual cues to
// catch dangerous values during data entry.

type Severity = 'ok' | 'warn' | 'alert';

function severityClasses(sev: Severity): string {
  if (sev === 'alert') {
    return 'border-red-400 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700 dark:bg-red-950/30 dark:text-red-200';
  }
  if (sev === 'warn') {
    return 'border-amber-400 bg-amber-50 text-amber-900 focus:border-amber-500 focus:ring-amber-500/20 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200';
  }
  return 'border-slate-900/10 focus:border-teal-600/50 focus:ring-teal-600/15';
}

function systolicSeverity(v: number): Severity {
  if (v > 180 || v < 70) return 'alert';
  if (v > 140 || v < 90) return 'warn';
  return 'ok';
}

function heartRateSeverity(v: number): Severity {
  if (v > 100 || v < 50) return 'warn';
  return 'ok';
}

function spo2Severity(v: number): Severity {
  if (v < 90) return 'alert';
  if (v < 95) return 'warn';
  return 'ok';
}

function temperatureSeverity(v: number): Severity {
  if (v > 39) return 'alert';
  if (v > 38) return 'warn';
  return 'ok';
}

function fieldClass(sev: Severity = 'ok', hasError = false) {
  return [
    'flex h-9 w-full rounded-[14px] border bg-white/85 px-3.5 text-sm text-slate-900 outline-none transition-colors backdrop-blur-[8px] focus:ring-4',
    'placeholder:text-slate-400',
    'disabled:cursor-not-allowed disabled:opacity-60',
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700'
      : severityClasses(sev),
  ].join(' ');
}

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold text-slate-700"
    >
      {children}
    </label>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface VitalSignsFormProps {
  patientId: string;
  /** Set to associate the new record with a specific clinical note. */
  clinicalNoteId?: string | null;
  /** Optional: called after a successful save (e.g. to refresh a list). */
  onSaved?: (vitalSignsId: string) => void;
  /** Compact variant (used inside the new-note page) hides the heading. */
  compact?: boolean;
}

interface FormState {
  weight_kg: string;
  height_cm: string;
  systolic_bp: string;
  diastolic_bp: string;
  heart_rate: string;
  respiratory_rate: string;
  temperature_c: string;
  oxygen_saturation: string;
  notes: string;
}

const EMPTY: FormState = {
  weight_kg: '',
  height_cm: '',
  systolic_bp: '',
  diastolic_bp: '',
  heart_rate: '',
  respiratory_rate: '',
  temperature_c: '',
  oxygen_saturation: '',
  notes: '',
};

function parseNum(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function VitalSignsForm({
  patientId,
  clinicalNoteId,
  onSaved,
  compact = false,
}: VitalSignsFormProps) {
  const [state, formAction, isPending] = useActionState<VitalSignsActionState, FormData>(
    createVitalSigns,
    null,
  );
  const [data, setData] = useState<FormState>(EMPTY);

  function set<K extends keyof FormState>(key: K, value: string) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  // ── BMI auto-calc — derived, not stored in state ───────────────────────────
  // We recompute on every render rather than mirror weight/height into a
  // `bmi` field, so the value can never drift out of sync with the inputs.
  const bmi = useMemo(() => {
    const w = parseNum(data.weight_kg);
    const h = parseNum(data.height_cm);
    if (w == null || h == null || w <= 0 || h <= 0) return null;
    const meters = h / 100;
    const value = w / (meters * meters);
    return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
  }, [data.weight_kg, data.height_cm]);

  const sysSev = useMemo(() => {
    const v = parseNum(data.systolic_bp);
    return v != null ? systolicSeverity(v) : 'ok';
  }, [data.systolic_bp]);
  const hrSev = useMemo(() => {
    const v = parseNum(data.heart_rate);
    return v != null ? heartRateSeverity(v) : 'ok';
  }, [data.heart_rate]);
  const spo2Sev = useMemo(() => {
    const v = parseNum(data.oxygen_saturation);
    return v != null ? spo2Severity(v) : 'ok';
  }, [data.oxygen_saturation]);
  const tempSev = useMemo(() => {
    const v = parseNum(data.temperature_c);
    return v != null ? temperatureSeverity(v) : 'ok';
  }, [data.temperature_c]);

  // Clear the form on a successful save so the assistant can keep recording
  // for the next patient without manually wiping each field.
  const justSavedId = state?.success ? state.vitalSignsId : null;
  useEffect(() => {
    if (justSavedId) {
      setData(EMPTY);
      onSaved?.(justSavedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only fire on a fresh save id
  }, [justSavedId]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set('patient_id', patientId);
    if (clinicalNoteId) fd.set('clinical_note_id', clinicalNoteId);
    (Object.keys(data) as (keyof FormState)[]).forEach((k) => {
      fd.set(k, data[k]);
    });
    startTransition(() => {
      formAction(fd);
    });
  }

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <section
      className={
        compact
          ? 'glass-card rounded-[22px] p-4'
          : 'glass-card rounded-[22px] p-5.5'
      }
    >
      {!compact && (
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          <h2 className="text-sm font-semibold text-slate-800">
            Signos vitales
          </h2>
        </div>
      )}
      {compact && (
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          <h2 className="text-sm font-semibold text-slate-800">
            Signos vitales
          </h2>
          <span className="text-xs text-slate-400">
            (al inicio de la consulta)
          </span>
        </div>
      )}

      {state && !state.success && (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-red-600/20 bg-red-100/70 px-3 py-2 text-xs text-red-700 backdrop-blur-md">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}
      {state?.success && (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-green-600/20 bg-green-100/70 px-3 py-2 text-xs text-green-700 backdrop-blur-md">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>Signos vitales registrados</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="vs_weight">Peso (kg)</Label>
            <input
              id="vs_weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={20}
              max={300}
              value={data.weight_kg}
              onChange={(e) => set('weight_kg', e.target.value)}
              placeholder="65.5"
              className={fieldClass('ok', !!fieldErrors?.weight_kg)}
            />
            {fieldErrors?.weight_kg && (
              <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.weight_kg[0]}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="vs_height">Talla (cm)</Label>
            <input
              id="vs_height"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={50}
              max={250}
              value={data.height_cm}
              onChange={(e) => set('height_cm', e.target.value)}
              placeholder="164"
              className={fieldClass('ok', !!fieldErrors?.height_cm)}
            />
            {fieldErrors?.height_cm && (
              <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.height_cm[0]}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>IMC (calculado)</Label>
            <input
              type="text"
              value={bmi != null ? String(bmi) : ''}
              readOnly
              placeholder="—"
              className={`${fieldClass()} bg-slate-900/4`}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="vs_temp">Temp. (°C)</Label>
            <input
              id="vs_temp"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={30}
              max={45}
              value={data.temperature_c}
              onChange={(e) => set('temperature_c', e.target.value)}
              placeholder="36.5"
              className={fieldClass(tempSev, !!fieldErrors?.temperature_c)}
            />
            {fieldErrors?.temperature_c && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {fieldErrors.temperature_c[0]}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="vs_sys">TA sistólica (mmHg)</Label>
            <input
              id="vs_sys"
              type="number"
              inputMode="numeric"
              min={60}
              max={250}
              value={data.systolic_bp}
              onChange={(e) => set('systolic_bp', e.target.value)}
              placeholder="120"
              className={fieldClass(sysSev, !!fieldErrors?.systolic_bp)}
            />
            {fieldErrors?.systolic_bp && (
              <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.systolic_bp[0]}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="vs_dia">TA diastólica (mmHg)</Label>
            <input
              id="vs_dia"
              type="number"
              inputMode="numeric"
              min={30}
              max={180}
              value={data.diastolic_bp}
              onChange={(e) => set('diastolic_bp', e.target.value)}
              placeholder="80"
              className={fieldClass('ok', !!fieldErrors?.diastolic_bp)}
            />
            {fieldErrors?.diastolic_bp && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {fieldErrors.diastolic_bp[0]}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="vs_hr">FC (lpm)</Label>
            <input
              id="vs_hr"
              type="number"
              inputMode="numeric"
              min={30}
              max={220}
              value={data.heart_rate}
              onChange={(e) => set('heart_rate', e.target.value)}
              placeholder="72"
              className={fieldClass(hrSev, !!fieldErrors?.heart_rate)}
            />
            {fieldErrors?.heart_rate && (
              <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.heart_rate[0]}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="vs_rr">FR (rpm)</Label>
            <input
              id="vs_rr"
              type="number"
              inputMode="numeric"
              min={5}
              max={60}
              value={data.respiratory_rate}
              onChange={(e) => set('respiratory_rate', e.target.value)}
              placeholder="16"
              className={fieldClass('ok', !!fieldErrors?.respiratory_rate)}
            />
            {fieldErrors?.respiratory_rate && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {fieldErrors.respiratory_rate[0]}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
          <div className="space-y-1">
            <Label htmlFor="vs_spo2">SpO2 (%)</Label>
            <input
              id="vs_spo2"
              type="number"
              inputMode="numeric"
              min={50}
              max={100}
              value={data.oxygen_saturation}
              onChange={(e) => set('oxygen_saturation', e.target.value)}
              placeholder="98"
              className={fieldClass(spo2Sev, !!fieldErrors?.oxygen_saturation)}
            />
            {fieldErrors?.oxygen_saturation && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {fieldErrors.oxygen_saturation[0]}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="vs_notes">Observaciones</Label>
            <input
              id="vs_notes"
              type="text"
              value={data.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Ej: paciente en reposo, ambiente cálido…"
              maxLength={2000}
              className={fieldClass()}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-slate-400">
            Los valores fuera de rango se resaltan automáticamente.
          </p>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar signos vitales
          </Button>
        </div>
      </form>
    </section>
  );
}
