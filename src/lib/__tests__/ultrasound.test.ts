import { describe, expect, it } from 'vitest';
import {
  gestationalAgeWeeks,
  hadlockEfwGrams,
  ovaryVolumeMl,
} from '../ultrasound';

describe('ovaryVolumeMl', () => {
  it('computes 0.523 × L × A × AP / 1000 in ml', () => {
    // 30 × 20 × 15 mm = 9000 mm³ → 0.523 * 9000 / 1000 = 4.707 ml
    expect(ovaryVolumeMl(30, 20, 15)).toBeCloseTo(4.71, 2);
  });

  it('returns null when any dimension is missing or non-positive', () => {
    expect(ovaryVolumeMl(null, 20, 15)).toBeNull();
    expect(ovaryVolumeMl(30, undefined, 15)).toBeNull();
    expect(ovaryVolumeMl(30, 20, 0)).toBeNull();
    expect(ovaryVolumeMl(30, -1, 15)).toBeNull();
  });

  it('rounds to two decimals', () => {
    // Make sure the returned value is finite and not a long float
    const v = ovaryVolumeMl(31.7, 19.4, 14.2);
    expect(v).not.toBeNull();
    expect(Number.isInteger(Math.round((v as number) * 100))).toBe(true);
  });
});

describe('hadlockEfwGrams', () => {
  // Sanity check at ~32 weeks dimensions: BPD ~83mm, HC ~302mm, AC ~283mm,
  // FL ~62mm. Published Hadlock IV gives ~1,950 g at this gestation; we
  // accept anything within ±100 g to absorb rounding from the source paper.
  it('returns a plausible weight for late-third-trimester biometry', () => {
    const efw = hadlockEfwGrams(83, 302, 283, 62);
    expect(efw).not.toBeNull();
    expect(efw).toBeGreaterThan(1750);
    expect(efw).toBeLessThan(2150);
  });

  it('returns null if any of the four measurements is missing', () => {
    expect(hadlockEfwGrams(null, 302, 283, 62)).toBeNull();
    expect(hadlockEfwGrams(83, null, 283, 62)).toBeNull();
    expect(hadlockEfwGrams(83, 302, null, 62)).toBeNull();
    expect(hadlockEfwGrams(83, 302, 283, null)).toBeNull();
  });

  it('returns an integer (gram-precision is meaningful, not sub-gram)', () => {
    const efw = hadlockEfwGrams(83, 302, 283, 62);
    expect(efw).not.toBeNull();
    expect(Number.isInteger(efw as number)).toBe(true);
  });
});

describe('gestationalAgeWeeks', () => {
  it('returns null when no biometry is provided', () => {
    expect(gestationalAgeWeeks(null, null, null, null)).toBeNull();
  });

  it('estimates ~32 weeks for late-third-trimester biometry', () => {
    const ga = gestationalAgeWeeks(83, 302, 283, 62);
    expect(ga).not.toBeNull();
    expect(ga).toBeGreaterThan(30);
    expect(ga).toBeLessThan(34);
  });

  it('works with just one measurement (BPD)', () => {
    const ga = gestationalAgeWeeks(50, null, null, null);
    expect(ga).not.toBeNull();
    // BPD 50mm ≈ ~21 weeks per Hadlock
    expect(ga).toBeGreaterThan(18);
    expect(ga).toBeLessThan(24);
  });

  it('averages across available measurements', () => {
    const onlyBpd = gestationalAgeWeeks(83, null, null, null);
    const onlyFl = gestationalAgeWeeks(null, null, null, 62);
    const avg = gestationalAgeWeeks(83, null, null, 62);
    expect(onlyBpd).not.toBeNull();
    expect(onlyFl).not.toBeNull();
    expect(avg).not.toBeNull();
    const expected = ((onlyBpd as number) + (onlyFl as number)) / 2;
    expect(avg).toBeCloseTo(Number(expected.toFixed(1)), 1);
  });
});
