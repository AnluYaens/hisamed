import { describe, expect, it } from 'vitest';
import {
  resolveDateRange,
  isValidDateStr,
  daysBetween,
  MAX_RANGE_DAYS,
} from '../date-range';

const TODAY = '2026-05-15';

describe('isValidDateStr', () => {
  it('accepts a real calendar date', () => {
    expect(isValidDateStr('2026-05-15')).toBe(true);
  });

  it('rejects malformed strings', () => {
    expect(isValidDateStr('')).toBe(false);
    expect(isValidDateStr('abc')).toBe(false);
    expect(isValidDateStr('2026-5-1')).toBe(false);
    expect(isValidDateStr(null)).toBe(false);
    expect(isValidDateStr(undefined)).toBe(false);
  });

  it('rejects impossible dates', () => {
    expect(isValidDateStr('2026-13-01')).toBe(false);
    expect(isValidDateStr('2026-02-30')).toBe(false);
  });
});

describe('daysBetween', () => {
  it('counts whole days inclusive of neither endpoint', () => {
    expect(daysBetween('2026-05-01', '2026-05-15')).toBe(14);
    expect(daysBetween('2026-05-15', '2026-05-15')).toBe(0);
  });
});

describe('resolveDateRange — presets', () => {
  it('last7 spans today and the prior 6 days', () => {
    const r = resolveDateRange('last7', TODAY);
    expect(r).toMatchObject({ preset: 'last7', from: '2026-05-09', to: TODAY, error: null });
  });

  it('last30 spans today and the prior 29 days', () => {
    const r = resolveDateRange('last30', TODAY);
    expect(r).toMatchObject({ preset: 'last30', from: '2026-04-16', to: TODAY, error: null });
  });

  it('currentMonth spans the first of the month to today', () => {
    const r = resolveDateRange('currentMonth', TODAY);
    expect(r).toMatchObject({
      preset: 'currentMonth',
      from: '2026-05-01',
      to: TODAY,
      error: null,
    });
  });

  it('falls back to the default preset for unknown values', () => {
    const r = resolveDateRange('garbage', TODAY);
    expect(r).toMatchObject({ preset: 'last30', from: '2026-04-16', to: TODAY });
  });

  it('treats a missing preset as the default', () => {
    const r = resolveDateRange(undefined, TODAY);
    expect(r.preset).toBe('last30');
  });
});

describe('resolveDateRange — custom range validation', () => {
  it('accepts a valid custom range unchanged', () => {
    const r = resolveDateRange('custom', TODAY, '2026-01-10', '2026-02-10');
    expect(r).toMatchObject({
      preset: 'custom',
      from: '2026-01-10',
      to: '2026-02-10',
      error: null,
    });
  });

  it('rejects a custom range with missing bounds', () => {
    const r = resolveDateRange('custom', TODAY, '', '');
    expect(r.error).toBeTruthy();
    // Falls back to a safe 30-day window.
    expect(r.from).toBe('2026-04-16');
    expect(r.to).toBe(TODAY);
  });

  it('rejects a custom range with invalid bounds', () => {
    const r = resolveDateRange('custom', TODAY, '2026-99-99', '2026-02-10');
    expect(r.error).toBeTruthy();
  });

  it('rejects a custom range where from is after to', () => {
    const r = resolveDateRange('custom', TODAY, '2026-03-01', '2026-02-01');
    expect(r.error).toMatch(/posterior/i);
  });

  it('rejects a custom range longer than the maximum', () => {
    const r = resolveDateRange('custom', TODAY, '2020-01-01', '2026-01-01');
    expect(r.error).toMatch(new RegExp(String(MAX_RANGE_DAYS)));
  });
});
