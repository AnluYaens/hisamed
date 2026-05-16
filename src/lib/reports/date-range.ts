/**
 * Date-range resolution for the clinic reports dashboard.
 *
 * All inputs/outputs are YYYY-MM-DD calendar-date strings. "Today" must be
 * supplied by the caller (derived from the clinic's timezone via
 * `todayInTz` — never from the server clock). Arithmetic is done on UTC
 * midnight so it is immune to the runtime timezone and DST, matching the
 * convention in `src/lib/obstetric.ts`.
 */

export type ReportRangePreset = 'last7' | 'last30' | 'currentMonth' | 'custom';

export const REPORT_RANGE_PRESETS: { value: ReportRangePreset; label: string }[] = [
  { value: 'last7', label: 'Últimos 7 días' },
  { value: 'last30', label: 'Últimos 30 días' },
  { value: 'currentMonth', label: 'Mes actual' },
  { value: 'custom', label: 'Rango personalizado' },
];

export const DEFAULT_PRESET: ReportRangePreset = 'last30';

/** Hard cap on a custom range so a report query can never scan years of rows. */
export const MAX_RANGE_DAYS = 366;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ResolvedRange {
  preset: ReportRangePreset;
  /** Inclusive lower bound, YYYY-MM-DD. */
  from: string;
  /** Inclusive upper bound, YYYY-MM-DD. */
  to: string;
  /** Spanish validation message when the requested custom range was invalid. */
  error: string | null;
}

function parseUTC(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z');
}

function toStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** True when `s` is a syntactically valid and real calendar date. */
export function isValidDateStr(s: string | null | undefined): s is string {
  if (!s || !DATE_RE.test(s)) return false;
  const d = parseUTC(s);
  return !Number.isNaN(d.getTime()) && toStr(d) === s;
}

function addDays(dateStr: string, days: number): string {
  return toStr(new Date(parseUTC(dateStr).getTime() + days * 86_400_000));
}

/** Whole days between two valid date strings (`to - from`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseUTC(to).getTime() - parseUTC(from).getTime()) / 86_400_000);
}

function normalizePreset(value: string | null | undefined): ReportRangePreset {
  return value === 'last7' ||
    value === 'last30' ||
    value === 'currentMonth' ||
    value === 'custom'
    ? value
    : DEFAULT_PRESET;
}

/**
 * Resolves a request's range parameters into concrete `from`/`to` bounds.
 *
 * Invalid custom input never throws: it falls back to the 30-day preset and
 * reports the reason in `error` so the page can surface a Spanish message.
 */
export function resolveDateRange(
  presetParam: string | null | undefined,
  today: string,
  customFrom?: string | null,
  customTo?: string | null,
): ResolvedRange {
  const preset = normalizePreset(presetParam);

  if (preset === 'last7') {
    return { preset, from: addDays(today, -6), to: today, error: null };
  }
  if (preset === 'last30') {
    return { preset, from: addDays(today, -29), to: today, error: null };
  }
  if (preset === 'currentMonth') {
    return { preset, from: today.slice(0, 8) + '01', to: today, error: null };
  }

  // Custom range — validate both bounds.
  const fallback = (error: string): ResolvedRange => ({
    preset: 'custom',
    from: addDays(today, -29),
    to: today,
    error,
  });

  if (!isValidDateStr(customFrom) || !isValidDateStr(customTo)) {
    return fallback('Selecciona una fecha de inicio y una fecha de fin válidas.');
  }
  if (customFrom > customTo) {
    return fallback('La fecha de inicio no puede ser posterior a la fecha de fin.');
  }
  if (daysBetween(customFrom, customTo) > MAX_RANGE_DAYS) {
    return fallback(`El rango no puede superar ${MAX_RANGE_DAYS} días.`);
  }

  return { preset: 'custom', from: customFrom, to: customTo, error: null };
}
