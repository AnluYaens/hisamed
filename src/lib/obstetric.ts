/**
 * Pure obstetric and general clinical calculators.
 *
 * All date inputs/outputs are YYYY-MM-DD strings. Internally we parse them as
 * UTC midnight (appending 'Z') so that arithmetic is always in exact
 * 86 400-second increments and DST transitions on the client's local clock
 * never cause an off-by-one-day error.
 */

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseDateUTC(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z');
}

function dateToStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Gestational age ──────────────────────────────────────────────────────────

/**
 * Returns { weeks, days } from fumDateStr to todayDateStr.
 * Both inputs must be YYYY-MM-DD in the clinic's timezone (from todayInTz on
 * the server, or the user's explicit input in the calculator).
 *
 * Edge cases guaranteed by UTC parsing:
 *   FUM today          → 0w 0d
 *   FUM 7 days ago     → 1w 0d
 *   FUM 280 days ago   → 40w 0d
 */
export function calcGestationalAge(
  fumDateStr: string,
  todayDateStr: string,
): { weeks: number; days: number } {
  const fum = parseDateUTC(fumDateStr);
  const today = parseDateUTC(todayDateStr);
  const totalDays = Math.floor((today.getTime() - fum.getTime()) / 86_400_000);
  if (totalDays < 0) return { weeks: 0, days: 0 };
  return { weeks: Math.floor(totalDays / 7), days: totalDays % 7 };
}

export function getGestationalTrimester(weeks: number): 1 | 2 | 3 {
  if (weeks < 13) return 1;
  if (weeks < 27) return 2;
  return 3;
}

export const TRIMESTER_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Primer trimestre',
  2: 'Segundo trimestre',
  3: 'Tercer trimestre',
};

// ─── FPP (Fecha probable de parto) ───────────────────────────────────────────

/**
 * Naegele's rule: FUM − 3 months + 7 days + 1 year.
 * Uses UTC-based Date.UTC arithmetic so month/day overflow is handled by the
 * JS engine, not by local-time DST state.
 */
export function calcFPPNaegele(fumDateStr: string): string {
  const d = parseDateUTC(fumDateStr);
  const result = new Date(
    Date.UTC(
      d.getUTCFullYear() + 1,
      d.getUTCMonth() - 3,  // JS wraps negative months correctly
      d.getUTCDate() + 7,   // JS wraps overflow days correctly
    ),
  );
  return dateToStr(result);
}

/** FUM + 280 days (pure day-count alternative). */
export function calcFPPByDays(fumDateStr: string): string {
  const d = parseDateUTC(fumDateStr);
  return dateToStr(new Date(d.getTime() + 280 * 86_400_000));
}

/** Reverse: given current gestational age, returns FPP. */
export function calcFPPFromGestationalAge(
  weeksNow: number,
  daysNow: number,
  todayDateStr: string,
): string {
  const daysRemaining = 280 - (weeksNow * 7 + daysNow);
  const d = parseDateUTC(todayDateStr);
  return dateToStr(new Date(d.getTime() + daysRemaining * 86_400_000));
}

// ─── BMI ──────────────────────────────────────────────────────────────────────

export function calcBMI(weightKg: number, heightCm: number): number {
  const hm = heightCm / 100;
  return weightKg / (hm * hm);
}

export interface BMIResult {
  bmi: number;
  category: string;
  categoryColor: 'blue' | 'green' | 'yellow' | 'orange' | 'red';
}

export function getBMIResult(weightKg: number, heightCm: number): BMIResult {
  const bmi = calcBMI(weightKg, heightCm);
  if (bmi < 18.5) return { bmi, category: 'Bajo peso', categoryColor: 'blue' };
  if (bmi < 25) return { bmi, category: 'Normal', categoryColor: 'green' };
  if (bmi < 30) return { bmi, category: 'Sobrepeso', categoryColor: 'yellow' };
  if (bmi < 35) return { bmi, category: 'Obesidad I', categoryColor: 'orange' };
  if (bmi < 40) return { bmi, category: 'Obesidad II', categoryColor: 'red' };
  return { bmi, category: 'Obesidad III (Mórbida)', categoryColor: 'red' };
}

/** Gestational weight gain recommendation (IOM 2009 guidelines). */
export function getGestationalWeightGain(preGestationalBMI: number): string {
  if (preGestationalBMI < 18.5) return '12.5 – 18 kg';
  if (preGestationalBMI < 25) return '11.5 – 16 kg';
  if (preGestationalBMI < 30) return '7 – 11.5 kg';
  return '5 – 9 kg';
}

// ─── Date display ─────────────────────────────────────────────────────────────

export function formatDateEs(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
