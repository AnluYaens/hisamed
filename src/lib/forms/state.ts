/**
 * Shared form-state helpers.
 *
 * React 19's `<form action={fn}>` calls `requestFormReset` before every action
 * runs, which wipes uncontrolled inputs back to their initial `defaultValue`.
 * On a validation failure that means the user loses everything they typed.
 *
 * These helpers fix the bug at two layers:
 *
 *   - Server: `formFailure(formData, ...)` builds a state object that echoes
 *     back the submitted FormData entries (minus password-like fields) and
 *     stamps a unique `submissionId`.
 *
 *   - Client: `formKey(state)` returns a value that changes on each failure
 *     so the form can be re-keyed (forcing input remount, which re-applies
 *     `defaultValue`). `echoValue(state, name)` reads the echoed value the
 *     user previously typed for a given field.
 *
 * Passwords are never echoed back through the DOM — they're stripped on the
 * server before the values ever leave the action.
 */

export type FormFieldErrors = Record<string, string[] | undefined>;

export interface FormFailure {
  success: false;
  error: string;
  fieldErrors?: FormFieldErrors;
  /** User-submitted values to re-populate inputs on failure. Password-like
   * fields are stripped. */
  values?: Record<string, string>;
  /** Changes on every failure; used as a `key` on the form to force remount
   * so `defaultValue` re-applies after React's auto form-reset. */
  submissionId?: number;
}

/** Field names whose values must NEVER be echoed back to the DOM. */
const PASSWORD_FIELDS: ReadonlySet<string> = new Set([
  'password',
  'confirmPassword',
  'confirm_password',
  'newPassword',
  'new_password',
  'currentPassword',
  'current_password',
  'oldPassword',
  'old_password',
]);

function extractValues(
  formData: FormData,
  extraExclude?: readonly string[],
): Record<string, string> {
  const exclude = new Set<string>(PASSWORD_FIELDS);
  if (extraExclude) {
    for (const k of extraExclude) exclude.add(k);
  }
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (exclude.has(k)) continue;
    // FormData values are string | File. Skip files — they can't be
    // re-populated into an <input type="file"> via defaultValue anyway.
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

// Seeded with a random base so distinct server processes (and the client
// initial render in dev) don't collide on `1, 2, 3…`. A plain monotonic
// counter is enough — the value only needs to differ from the *previous*
// failure on the same client, which a counter trivially guarantees.
let counter = Math.floor(Math.random() * 1_000_000);
function nextSubmissionId(): number {
  counter += 1;
  return counter;
}

/**
 * Build a `FormFailure` state object that echoes submitted values back to the
 * client. Pass the raw `FormData` you received in the action plus the user-
 * facing error message and the per-field errors (typically from
 * `zodError.flatten().fieldErrors`).
 *
 * @param extraExclude additional field names to strip beyond the default
 *   password fields (rarely needed).
 */
export function formFailure(
  formData: FormData | null | undefined,
  opts: {
    error: string;
    fieldErrors?: FormFieldErrors;
    extraExclude?: readonly string[];
  },
): FormFailure {
  return {
    success: false,
    error: opts.error,
    fieldErrors: opts.fieldErrors,
    values: formData ? extractValues(formData, opts.extraExclude) : undefined,
    submissionId: nextSubmissionId(),
  };
}

type AnyState = { success?: boolean; submissionId?: number; values?: Record<string, string> } | null | undefined;

/**
 * Returns a stable key for the `<form>` element. The key changes on each
 * failed submission, forcing React to remount the form's children so their
 * `defaultValue` attributes pick up the freshly echoed user input.
 */
export function formKey(state: AnyState): string {
  if (state && state.success === false && typeof state.submissionId === 'number') {
    return `s-${state.submissionId}`;
  }
  return 'initial';
}

/**
 * Read the user's previously-typed value for a field from a failed state,
 * or `undefined` if there's nothing echoed. Designed to be chained with the
 * existing default (e.g. record value, prop default):
 *
 *     defaultValue={echoValue(state, 'first_name') ?? patient?.firstName ?? ''}
 */
export function echoValue(state: AnyState, name: string): string | undefined {
  if (state && state.success === false && state.values) {
    const v = state.values[name];
    return typeof v === 'string' ? v : undefined;
  }
  return undefined;
}

/**
 * Variant of `echoValue` for checkboxes — returns `true` iff the field was
 * present in the submitted FormData (i.e. the box was checked). Falls back
 * to `undefined` when there's no echo, so callers can chain with their own
 * default:
 *
 *     defaultChecked={echoChecked(state, 'rh_incompatibility') ?? patient?.rh ?? false}
 */
export function echoChecked(state: AnyState, name: string): boolean | undefined {
  if (state && state.success === false && state.values) {
    return name in state.values;
  }
  return undefined;
}
