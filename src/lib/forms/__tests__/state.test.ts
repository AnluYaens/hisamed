import { describe, expect, it } from 'vitest';
import { echoChecked, echoValue, formFailure, formKey } from '../state';

function fd(entries: Array<[string, string]>): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe('formFailure', () => {
  it('echoes submitted values back', () => {
    const f = fd([
      ['email', 'a@b.com'],
      ['first_name', 'Ana'],
    ]);
    const s = formFailure(f, { error: 'oops' });
    expect(s.success).toBe(false);
    expect(s.error).toBe('oops');
    expect(s.values).toEqual({ email: 'a@b.com', first_name: 'Ana' });
    expect(typeof s.submissionId).toBe('number');
  });

  it('strips password-like fields by default (never persists them back to the DOM)', () => {
    const f = fd([
      ['email', 'a@b.com'],
      ['password', 'secret-123-456'],
      ['confirmPassword', 'secret-123-456'],
      ['confirm_password', 'secret-123-456'],
      ['newPassword', 'x'],
      ['new_password', 'x'],
      ['currentPassword', 'x'],
      ['current_password', 'x'],
      ['oldPassword', 'x'],
      ['old_password', 'x'],
    ]);
    const s = formFailure(f, { error: 'oops' });
    expect(s.values).toEqual({ email: 'a@b.com' });
  });

  it('respects extraExclude for additional sensitive fields', () => {
    const f = fd([
      ['email', 'a@b.com'],
      ['ssn', '111-22-3333'],
    ]);
    const s = formFailure(f, { error: 'oops', extraExclude: ['ssn'] });
    expect(s.values).toEqual({ email: 'a@b.com' });
  });

  it('produces a new submissionId each time so form key changes on every failure', () => {
    const f = fd([['email', 'a@b.com']]);
    const s1 = formFailure(f, { error: 'a' });
    const s2 = formFailure(f, { error: 'b' });
    expect(s1.submissionId).not.toBe(s2.submissionId);
  });

  it('carries through fieldErrors', () => {
    const f = fd([['email', 'bad']]);
    const s = formFailure(f, {
      error: 'oops',
      fieldErrors: { email: ['Invalid'] },
    });
    expect(s.fieldErrors).toEqual({ email: ['Invalid'] });
  });

  it('tolerates a null/undefined formData (auth-failure paths) and omits values', () => {
    const s = formFailure(null, { error: 'No autenticado' });
    expect(s.values).toBeUndefined();
    expect(s.error).toBe('No autenticado');
  });
});

describe('formKey', () => {
  it('returns "initial" for null / no-failure states', () => {
    expect(formKey(null)).toBe('initial');
    expect(formKey(undefined)).toBe('initial');
    expect(formKey({ success: true })).toBe('initial');
  });

  it('returns a unique key per submission so the form remounts on failure', () => {
    const s1 = formFailure(fd([]), { error: 'a' });
    const s2 = formFailure(fd([]), { error: 'b' });
    expect(formKey(s1)).not.toBe(formKey(s2));
    expect(formKey(s1)).not.toBe('initial');
  });
});

describe('echoValue', () => {
  it('returns the submitted value for the named field', () => {
    const s = formFailure(fd([['first_name', 'Ana']]), { error: 'x' });
    expect(echoValue(s, 'first_name')).toBe('Ana');
  });

  it('returns undefined when the field was not submitted', () => {
    const s = formFailure(fd([['first_name', 'Ana']]), { error: 'x' });
    expect(echoValue(s, 'missing')).toBeUndefined();
  });

  it('returns undefined for null state / success state', () => {
    expect(echoValue(null, 'x')).toBeUndefined();
    expect(echoValue({ success: true }, 'x')).toBeUndefined();
  });

  it('never echoes password fields', () => {
    const s = formFailure(fd([['password', 'secret']]), { error: 'x' });
    expect(echoValue(s, 'password')).toBeUndefined();
  });
});

describe('echoChecked', () => {
  it('returns true when the checkbox was submitted (i.e. checked)', () => {
    const s = formFailure(fd([['terms', 'on']]), { error: 'x' });
    expect(echoChecked(s, 'terms')).toBe(true);
  });

  it('returns false when the field was missing from a failed submission (unchecked)', () => {
    const s = formFailure(fd([['email', 'a@b.com']]), { error: 'x' });
    expect(echoChecked(s, 'terms')).toBe(false);
  });

  it('returns undefined for null/success state so callers can use their own default', () => {
    expect(echoChecked(null, 'terms')).toBeUndefined();
    expect(echoChecked({ success: true }, 'terms')).toBeUndefined();
  });
});
