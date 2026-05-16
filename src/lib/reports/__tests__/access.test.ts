import { describe, expect, it } from 'vitest';
import { canAccessReports, canFilterByDoctor } from '../access';

describe('canAccessReports', () => {
  it('allows admins', () => {
    expect(canAccessReports('admin')).toBe(true);
  });

  it('allows doctors', () => {
    expect(canAccessReports('doctor')).toBe(true);
  });

  it('blocks receptionists', () => {
    expect(canAccessReports('receptionist')).toBe(false);
  });

  it('blocks an absent role', () => {
    expect(canAccessReports(null)).toBe(false);
    expect(canAccessReports(undefined)).toBe(false);
  });
});

describe('canFilterByDoctor', () => {
  it('is admin-only', () => {
    expect(canFilterByDoctor('admin')).toBe(true);
    expect(canFilterByDoctor('doctor')).toBe(false);
    expect(canFilterByDoctor('receptionist')).toBe(false);
    expect(canFilterByDoctor(null)).toBe(false);
  });
});
