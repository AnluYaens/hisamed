// ─── Shared read-only demo account — security suite ───────────────────────────
//
// Locks in the three guarantees the demo account depends on:
//
//   1. READ-ONLY ENFORCEMENT
//      a) Static: every write Server Action in src/actions/ either carries the
//         demo guard (`isDemoSession`) or is explicitly listed as demo-allowed.
//         Adding a new write action without the guard fails CI loudly.
//      b) Runtime: invoked as a demo session, every write action returns the
//         blocked message and writes nothing to the DB.
//
//   2. /demo AUTO-LOGIN FAILS CLOSED
//      The route only ever mints a session for the exact (DEMO_USER_ID,
//      DEMO_CLINIC_ID) active user. Inactive user, wrong clinic, or injected
//      ids → redirect to /?demo=unavailable, no cookies, no token for anyone.
//
//   3. DEMO ISOLATION (named, not merely inferred from clinic-isolation)
//      A demo session cannot read another clinic's data.
//
//   4. MUTATING API ROUTES (attachments/upload, email-history)
//      Demo session → 403, no side effects.
//
// Mirrors tests/unit/cross-tenant-isolation.test.ts: runs against the real
// local Postgres, self-skips if unreachable, and mocks only the Next/auth
// shim layer. The demo ids are overridden via env (in a hoisted block, before
// any module loads) to fixed *test* ids so the suite is hermetic and never
// touches a developer's real `db:seed-demo` data.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';

import * as schema from '@/lib/db/schema';

// ─── Override demo ids BEFORE any module that reads them is loaded ────────────
// vi.hoisted runs before the file's imports, so src/lib/auth/demo.ts (loaded
// later, dynamically) picks up these values instead of its baked-in defaults.
const DEMO = vi.hoisted(() => {
  const clinic = 'd0000000-0000-4000-8000-0000000000c1';
  const user = 'd0000000-0000-4000-8000-0000000000c2';
  process.env.DEMO_CLINIC_ID = clinic;
  process.env.DEMO_USER_ID = user;
  return { clinic, user };
});

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://clinica:clinica_dev@localhost:5432/clinica_mvp';

let pool: Pool;
let db: ReturnType<typeof drizzle<typeof schema>>;
let dbReachable = false;

// Resolved in beforeAll from the (env-overridden) demo module.
let MSG = '';

// ─── Shim mocks ───────────────────────────────────────────────────────────────

type Role = 'admin' | 'doctor' | 'receptionist';
interface FakeSession { userId: string; clinicId: string; role: Role }
const sessionState: { current: FakeSession | null } = { current: null };

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(async () => sessionState.current),
  requireSession: vi.fn(async () => {
    if (!sessionState.current) throw new Error('No autenticado');
    return sessionState.current;
  }),
  requireRole: vi.fn(async (allowed: Role[]) => {
    if (!sessionState.current) throw new Error('No autenticado');
    if (!allowed.includes(sessionState.current.role)) throw new Error('Sin permisos');
    return sessionState.current;
  }),
}));

// Token + cookie layer for the /demo route. Mocked so we can assert exactly
// which claims a session would be minted for (the identity) without needing
// real JWT secrets, and whether a session was created at all.
interface DemoClaims { userId: string; clinicId: string; role: string }
const authMocks = vi.hoisted(() => ({
  generateAccessToken: vi.fn(async (_claims: DemoClaims) => 'access-token'),
  generateRefreshToken: vi.fn(async (_claims: DemoClaims) => 'refresh-token'),
  setAuthCookies: vi.fn(),
  sendPatientHistoryEmail: vi.fn(async () => ({ ok: true, id: 'mock' })),
}));
vi.mock('@/lib/auth/tokens', () => ({
  generateAccessToken: authMocks.generateAccessToken,
  generateRefreshToken: authMocks.generateRefreshToken,
}));
vi.mock('@/lib/auth/cookies', () => ({ setAuthCookies: authMocks.setAuthCookies }));

vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

class RedirectCalled extends Error {
  constructor(public to: string) { super(`NEXT_REDIRECT:${to}`); }
}
vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => { throw new RedirectCalled(to); }),
}));

vi.mock('@/lib/storage', () => ({
  getObject: vi.fn(async () => ({ body: Buffer.from('x'), contentType: 'application/pdf', contentLength: 1 })),
  getPresignedUrl: vi.fn(async () => null),
  uploadFile: vi.fn(async () => undefined),
  deleteFile: vi.fn(async () => undefined),
}));

vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 99, retryAfterSeconds: 0 })),
  enforceRateLimits: vi.fn(async () => ({ allowed: true, remaining: 99, retryAfterSeconds: 0 })),
}));

// getResendConfig returns a *valid* config so that, if the demo guard were
// missing, the email route would actually try to send — making the assertion
// "sendPatientHistoryEmail was NOT called" load-bearing.
vi.mock('@/lib/email/resend', () => ({
  getResendConfig: () => ({ apiKey: 'test', fromEmail: 'test@example.com', fromName: 'Hisamed' }),
  sendPatientHistoryEmail: authMocks.sendPatientHistoryEmail,
}));
vi.mock('@/lib/pdf/patient-history', () => ({
  buildPatientHistoryPdf: vi.fn(async () => Buffer.from('PDF')),
  exportHistoryFilename: () => 'historia.pdf',
}));

vi.mock('@/lib/db', async () => {
  const realPg = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const localPool = new realPg.Pool({ connectionString: TEST_DATABASE_URL, max: 5 });
  const localDb = drizzle(localPool, { schema });
  (globalThis as Record<string, unknown>).__demoTestPool = localPool;
  return { db: localDb };
});

// ─── Fixture ────────────────────────────────────────────────────────────────

const demoPatient = randomUUID();
const demoNote = randomUUID();
const demoAppt = randomUUID();
const demoVitals = randomUUID();
const demoAttachment = randomUUID();
const demoPartner = randomUUID();
const demoDocument = randomUUID();

// A *real* (non-demo) clinic the demo session must never be able to read.
const R = {
  clinic: randomUUID(),
  user: randomUUID(),
  patient: randomUUID(),
  note: randomUUID(),
};
const TAG = `demo-sec-${Date.now()}`;
const R_MARKER = `RMARKER-${TAG}`;

function demoSession(): FakeSession {
  return { userId: DEMO.user, clinicId: DEMO.clinic, role: 'doctor' };
}

beforeAll(async () => {
  pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 5 });
  try {
    await pool.query('SELECT 1');
    dbReachable = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `\n[demo-readonly] DB not reachable at ${TEST_DATABASE_URL.replace(/:[^:@]+@/, ':***@')} — suite skipped.\n` +
        `Reason: ${(err as Error).message}\n`,
    );
    return;
  }
  db = drizzle(pool, { schema });

  const demo = await import('@/lib/auth/demo');
  MSG = demo.DEMO_READONLY_MESSAGE;
  // Sanity: the env override took effect and the code agrees with our fixture.
  expect(demo.DEMO_CLINIC_ID).toBe(DEMO.clinic);
  expect(demo.DEMO_USER_ID).toBe(DEMO.user);

  // Defensive: clear any stray rows from a previous aborted run.
  await cleanup();

  await db.insert(schema.clinics).values([
    { id: DEMO.clinic, name: `Demo-${TAG}`, timezone: 'America/Caracas', subscriptionStatus: 'active' },
    { id: R.clinic, name: `Real-${TAG}`, timezone: 'America/Caracas' },
  ]);

  await db.insert(schema.users).values([
    { id: DEMO.user, clinicId: DEMO.clinic, email: `demo-${TAG}@t`, passwordHash: 'x', fullName: 'Demo Doctor', role: 'doctor', isActive: true },
    { id: R.user, clinicId: R.clinic, email: `real-${TAG}@t`, passwordHash: 'x', fullName: 'Real Doctor', role: 'doctor', isActive: true },
  ]);

  await db.insert(schema.patients).values([
    { id: demoPatient, clinicId: DEMO.clinic, idNumber: `DEMO-${TAG}`, firstName: 'María', lastName: 'Demo', dateOfBirth: '1991-01-01', sex: 'F', createdBy: DEMO.user, isActive: true },
    { id: R.patient, clinicId: R.clinic, idNumber: R_MARKER, firstName: 'Real', lastName: 'Patient', dateOfBirth: '1980-02-02', sex: 'F', createdBy: R.user, isActive: true },
  ]);

  await db.insert(schema.medicalHistories).values([
    { patientId: demoPatient, allergies: 'demo-allergy', updatedBy: DEMO.user },
  ]);

  await db.insert(schema.patientPartners).values([
    { id: demoPartner, patientId: demoPatient, fullName: 'Demo Partner' },
  ]);

  await db.insert(schema.appointments).values([
    { id: demoAppt, clinicId: DEMO.clinic, patientId: demoPatient, doctorId: DEMO.user, date: '2026-06-01', startTime: '09:00', endTime: '09:30', status: 'scheduled', createdBy: DEMO.user },
  ]);

  await db.insert(schema.clinicalNotes).values([
    { id: demoNote, patientId: demoPatient, authorId: DEMO.user, noteDate: '2026-06-01', chiefComplaint: 'demo-original', diagnoses: [], isSigned: false },
    { id: R.note, patientId: R.patient, authorId: R.user, noteDate: '2026-06-01', chiefComplaint: R_MARKER, diagnoses: [], isSigned: false },
  ]);

  await db.insert(schema.clinicalDocuments).values([
    { id: demoDocument, clinicId: DEMO.clinic, patientId: demoPatient, authorId: DEMO.user, documentType: 'medical_certificate', title: 'demo doc', content: {} },
  ]);

  await db.insert(schema.vitalSigns).values([
    { id: demoVitals, clinicId: DEMO.clinic, patientId: demoPatient, recordedBy: DEMO.user, systolicBp: 120, diastolicBp: 80 },
  ]);

  await db.insert(schema.attachments).values([
    { id: demoAttachment, patientId: demoPatient, uploadedBy: DEMO.user, fileName: 'd.pdf', storageKey: 'd-key', fileType: 'application/pdf', fileSizeBytes: 1, category: 'lab_result' },
  ]);
}, 30_000);

async function cleanup() {
  const demoPatientIds = [demoPatient];
  await db.delete(schema.attachments).where(inArray(schema.attachments.patientId, [demoPatient, R.patient]));
  await db.delete(schema.vitalSigns).where(inArray(schema.vitalSigns.clinicId, [DEMO.clinic, R.clinic]));
  await db.delete(schema.clinicalDocuments).where(inArray(schema.clinicalDocuments.clinicId, [DEMO.clinic, R.clinic]));
  await db.delete(schema.clinicalNotes).where(inArray(schema.clinicalNotes.patientId, [demoPatient, R.patient]));
  await db.delete(schema.medicalHistories).where(inArray(schema.medicalHistories.patientId, demoPatientIds.concat(R.patient)));
  await db.delete(schema.patientPartners).where(inArray(schema.patientPartners.patientId, [demoPatient, R.patient]));
  await db.delete(schema.appointments).where(inArray(schema.appointments.clinicId, [DEMO.clinic, R.clinic]));
  await db.delete(schema.auditLogs).where(inArray(schema.auditLogs.clinicId, [DEMO.clinic, R.clinic]));
  await db.delete(schema.patients).where(inArray(schema.patients.id, [demoPatient, R.patient]));
  await db.delete(schema.users).where(inArray(schema.users.id, [DEMO.user, R.user]));
  await db.delete(schema.clinics).where(inArray(schema.clinics.id, [DEMO.clinic, R.clinic]));
}

afterAll(async () => {
  if (!dbReachable) {
    if (pool) await pool.end().catch(() => undefined);
    return;
  }
  try {
    await cleanup();
  } finally {
    if (pool) await pool.end().catch(() => undefined);
    const tp = (globalThis as Record<string, unknown>).__demoTestPool as Pool | undefined;
    if (tp) await tp.end().catch(() => undefined);
  }
}, 30_000);

const itDb = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!dbReachable) {
      // eslint-disable-next-line no-console
      console.warn(`[skipped — DB unreachable] ${name}`);
      return;
    }
    await fn();
  });

// ─── 1a. Static guard coverage ────────────────────────────────────────────────
//
// Read-only / public actions that legitimately do NOT carry the demo guard.
// Anything not in this set MUST contain `isDemoSession(`. A new write action
// added without the guard (and without a deliberate entry here) fails here.

const DEMO_ALLOWED = new Set([
  'searchPatients', // read-only query
  'registerClinic', // public sign-up — no session yet, creates a new clinic
  'submitAccessRequest', // public landing form — no session
]);

describe('Demo read-only — static guard coverage', () => {
  const actionsDir = resolve(__dirname, '../../src/actions');
  const files = readdirSync(actionsDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  // Build [file, fnName, body] for every exported async action across all files.
  const entries: Array<{ file: string; name: string; body: string }> = [];
  for (const file of files) {
    const src = readFileSync(resolve(actionsDir, file), 'utf8');
    const re = /export async function (\w+)/g;
    const marks: Array<{ name: string; index: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) marks.push({ name: m[1], index: m.index });
    for (let i = 0; i < marks.length; i++) {
      const start = marks[i].index;
      const end = i + 1 < marks.length ? marks[i + 1].index : src.length;
      entries.push({ file, name: marks[i].name, body: src.slice(start, end) });
    }
  }

  it('discovers the expected number of actions (guard against a broken parser)', () => {
    expect(entries.length).toBeGreaterThanOrEqual(26);
  });

  it.each(entries.filter((e) => !DEMO_ALLOWED.has(e.name)))(
    'write action $name ($file) carries the demo read-only guard',
    ({ body, name }) => {
      expect(body, `${name} is missing isDemoSession() — add the guard or list it in DEMO_ALLOWED`).
        toContain('isDemoSession(');
    },
  );

  it('every demo-allowed action actually exists (keeps the allow-list honest)', () => {
    const names = new Set(entries.map((e) => e.name));
    for (const allowed of DEMO_ALLOWED) {
      expect(names.has(allowed), `DEMO_ALLOWED lists "${allowed}" but no such action exists`).toBe(true);
    }
  });
});

// ─── 1b. Runtime: every write action is blocked + writes nothing ──────────────

function fd(): FormData {
  const f = new FormData();
  // A grab-bag of ids so each action reaches its demo guard. The guard fires
  // before validation, so unrelated extra keys are harmless.
  f.set('patient_id', demoPatient);
  f.set('note_id', demoNote);
  f.set('clinical_note_id', demoNote);
  f.set('appointment_id', demoAppt);
  f.set('attachment_id', demoAttachment);
  f.set('vital_signs_id', demoVitals);
  f.set('user_id', DEMO.user);
  f.set('status', 'confirmed');
  f.set('payload', JSON.stringify({ document_type: 'medical_certificate', title: 't', content: {} }));
  return f;
}

// Literal import map — Vite/vitest resolves static specifiers reliably, where a
// fully templated `import(`@/actions/${file}`)` would not be analyzable.
const MODS: Record<string, () => Promise<Record<string, unknown>>> = {
  patients: () => import('@/actions/patients'),
  appointments: () => import('@/actions/appointments'),
  attachments: () => import('@/actions/attachments'),
  clinic: () => import('@/actions/clinic'),
  'clinical-documents': () => import('@/actions/clinical-documents'),
  'clinical-notes': () => import('@/actions/clinical-notes'),
  'medical-history': () => import('@/actions/medical-history'),
  'partner-avatar': () => import('@/actions/partner-avatar'),
  'patient-avatar': () => import('@/actions/patient-avatar'),
  users: () => import('@/actions/users'),
  'vital-signs': () => import('@/actions/vital-signs'),
};

type FormAction = (p: unknown, f: FormData) => Promise<unknown>;
async function load(file: string, name: string): Promise<FormAction> {
  const mod = await MODS[file]();
  return mod[name] as FormAction;
}

async function countDemoRows() {
  const [pat, appt, vit, doc, usr, notes, mh, partners, atts] = await Promise.all([
    db.query.patients.findMany({ where: eq(schema.patients.clinicId, DEMO.clinic) }),
    db.query.appointments.findMany({ where: eq(schema.appointments.clinicId, DEMO.clinic) }),
    db.query.vitalSigns.findMany({ where: eq(schema.vitalSigns.clinicId, DEMO.clinic) }),
    db.query.clinicalDocuments.findMany({ where: eq(schema.clinicalDocuments.clinicId, DEMO.clinic) }),
    db.query.users.findMany({ where: eq(schema.users.clinicId, DEMO.clinic) }),
    db.query.clinicalNotes.findMany({ where: eq(schema.clinicalNotes.patientId, demoPatient) }),
    db.query.medicalHistories.findMany({ where: eq(schema.medicalHistories.patientId, demoPatient) }),
    db.query.patientPartners.findMany({ where: eq(schema.patientPartners.patientId, demoPatient) }),
    db.query.attachments.findMany({ where: eq(schema.attachments.patientId, demoPatient) }),
  ]);
  return {
    patients: pat.length, appointments: appt.length, vitalSigns: vit.length,
    clinicalDocuments: doc.length, users: usr.length, clinicalNotes: notes.length,
    medicalHistories: mh.length, patientPartners: partners.length, attachments: atts.length,
  };
}

describe('Demo read-only — runtime enforcement on every write action', () => {
  // Every (file, fn) that writes. searchPatients/registerClinic/submitAccessRequest
  // are excluded (read-only / public — see DEMO_ALLOWED).
  const formActions: Array<[string, string]> = [
    ['patients', 'createPatient'],
    ['patients', 'updatePatient'],
    ['patients', 'togglePatientActive'],
    ['patients', 'upsertPatientPartner'],
    ['appointments', 'createAppointment'],
    ['appointments', 'updateAppointmentStatus'],
    ['appointments', 'cancelAppointment'],
    ['attachments', 'deleteAttachment'],
    ['clinic', 'updateClinicSettings'],
    ['clinical-documents', 'createClinicalDocument'],
    ['clinical-notes', 'createClinicalNote'],
    ['clinical-notes', 'updateClinicalNote'],
    ['clinical-notes', 'signClinicalNote'],
    ['medical-history', 'updateMedicalHistory'],
    ['partner-avatar', 'updatePartnerAvatar'],
    ['partner-avatar', 'removePartnerAvatar'],
    ['patient-avatar', 'updatePatientAvatar'],
    ['patient-avatar', 'removePatientAvatar'],
    ['users', 'createUser'],
    ['users', 'updateUser'],
    ['users', 'resetUserPassword'],
    ['vital-signs', 'createVitalSigns'],
    ['vital-signs', 'attachVitalSignsToNote'],
  ];

  itDb('all FormData write actions return the blocked message as a demo session', async () => {
    sessionState.current = demoSession();
    for (const [file, name] of formActions) {
      const action = await load(file, name);
      const result = await action(null, fd()).catch((e) => e);
      if (result instanceof RedirectCalled) {
        throw new Error(`${name} performed a write (redirected to ${result.to}) as a demo session`);
      }
      expect(result, `${file}/${name} should be blocked`).toEqual({ success: false, error: MSG });
    }
  });

  itDb('importPatients returns the blocked ImportResult as a demo session', async () => {
    sessionState.current = demoSession();
    const importPatients = (await import('@/actions/import-patients')).importPatients;
    const result = await importPatients([
      { id_number: `X-${TAG}`, first_name: 'X', last_name: 'Y', date_of_birth: '1990-01-01', sex: 'F' },
    ]);
    expect(result).toEqual({ success: false, imported: 0, errors: [], error: MSG });
  });

  itDb('no demo-clinic rows changed after exercising every write action', async () => {
    sessionState.current = demoSession();
    const before = await countDemoRows();

    for (const [file, name] of formActions) {
      const action = await load(file, name);
      await action(null, fd()).catch(() => undefined);
    }
    const importPatients = (await import('@/actions/import-patients')).importPatients;
    await importPatients([
      { id_number: `Z-${TAG}`, first_name: 'Z', last_name: 'Z', date_of_birth: '1990-01-01', sex: 'F' },
    ]).catch(() => undefined);

    const after = await countDemoRows();
    expect(after).toEqual(before);

    // Spot-check that mutable fields were untouched, not just row counts.
    const note = await db.query.clinicalNotes.findFirst({ where: eq(schema.clinicalNotes.id, demoNote) });
    expect(note?.chiefComplaint).toBe('demo-original');
    expect(note?.isSigned).toBe(false);
    const mh = await db.query.medicalHistories.findFirst({ where: eq(schema.medicalHistories.patientId, demoPatient) });
    expect(mh?.allergies).toBe('demo-allergy');
  });
});

// ─── 2. /demo auto-login fails closed ─────────────────────────────────────────

describe('/demo auto-login — only ever authenticates the demo user', () => {
  async function callDemo(url = 'http://localhost/demo') {
    const mod = await import('@/app/demo/route');
    return mod.GET(new Request(url) as never);
  }

  itDb('happy path: mints a session for the exact demo user and redirects to /inicio', async () => {
    authMocks.generateAccessToken.mockClear();
    authMocks.setAuthCookies.mockClear();
    const res = await callDemo();

    expect(res.headers.get('location')).toContain('/inicio');
    expect(authMocks.setAuthCookies).toHaveBeenCalledTimes(1);
    expect(authMocks.generateAccessToken).toHaveBeenCalledTimes(1);
    // The minted identity is the demo user — nothing else.
    expect(authMocks.generateAccessToken.mock.calls[0][0]).toEqual({
      userId: DEMO.user,
      clinicId: DEMO.clinic,
      role: 'doctor',
    });
  });

  itDb('injected user_id / clinic_id query params are ignored — still the demo user', async () => {
    authMocks.generateAccessToken.mockClear();
    authMocks.setAuthCookies.mockClear();
    const res = await callDemo(
      `http://localhost/demo?user_id=${R.user}&clinic_id=${R.clinic}&id=${R.user}`,
    );
    expect(res.headers.get('location')).toContain('/inicio');
    expect(authMocks.generateAccessToken).toHaveBeenCalledTimes(1);
    expect(authMocks.generateAccessToken.mock.calls[0][0]).toEqual({
      userId: DEMO.user,
      clinicId: DEMO.clinic,
      role: 'doctor',
    });
    // Never the real clinic's user.
    expect(authMocks.generateAccessToken.mock.calls[0][0]).not.toMatchObject({ userId: R.user });
  });

  itDb('inactive demo user → unavailable, no session minted', async () => {
    authMocks.generateAccessToken.mockClear();
    authMocks.setAuthCookies.mockClear();
    await db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, DEMO.user));
    try {
      const res = await callDemo();
      expect(res.headers.get('location')).toContain('demo=unavailable');
      expect(authMocks.setAuthCookies).not.toHaveBeenCalled();
      expect(authMocks.generateAccessToken).not.toHaveBeenCalled();
    } finally {
      await db.update(schema.users).set({ isActive: true }).where(eq(schema.users.id, DEMO.user));
    }
  });

  itDb('demo user id present but in a different clinic → unavailable (also covers "seed missing")', async () => {
    authMocks.generateAccessToken.mockClear();
    authMocks.setAuthCookies.mockClear();
    // Move the demo user out of the demo clinic. The route's (id AND clinic)
    // predicate now matches zero rows — the same fail-closed branch hit when
    // the demo seed is absent entirely.
    await db.update(schema.users).set({ clinicId: R.clinic }).where(eq(schema.users.id, DEMO.user));
    try {
      const res = await callDemo();
      expect(res.headers.get('location')).toContain('demo=unavailable');
      expect(authMocks.setAuthCookies).not.toHaveBeenCalled();
      expect(authMocks.generateAccessToken).not.toHaveBeenCalled();
    } finally {
      await db.update(schema.users).set({ clinicId: DEMO.clinic }).where(eq(schema.users.id, DEMO.user));
    }
  });
});

// ─── 3. Demo isolation (named) ────────────────────────────────────────────────

describe('Demo isolation — a demo session cannot read another clinic data', () => {
  itDb('getPatientById: demo scope + real-clinic patient id returns null', async () => {
    sessionState.current = demoSession();
    const { getPatientById } = await import('@/queries/patients');
    const leaked = await getPatientById(DEMO.clinic, R.patient);
    expect(leaked).toBeNull();
    // Sanity: the demo patient IS visible under the demo clinic.
    const own = await getPatientById(DEMO.clinic, demoPatient);
    expect(own?.id).toBe(demoPatient);
  });

  itDb('getClinicalNotesByPatient: demo session gets nothing for a real-clinic patient', async () => {
    sessionState.current = demoSession();
    const { getClinicalNotesByPatient } = await import('@/queries/clinical-notes');
    const rows = await getClinicalNotesByPatient(DEMO.clinic, R.patient);
    expect(rows).toEqual([]);
  });

  itDb('globalSearch: demo session does not surface real-clinic patients or notes', async () => {
    sessionState.current = demoSession();
    const { globalSearch } = await import('@/queries/global-search');
    const result = await globalSearch(DEMO.clinic, 'doctor', R_MARKER);
    expect(result.patients.find((p) => p.id === R.patient)).toBeUndefined();
    expect(result.notes.find((n) => n.id === R.note)).toBeUndefined();
  });
});

// ─── 4. Mutating API routes ───────────────────────────────────────────────────

describe('Demo read-only — mutating API routes return 403 with no side effects', () => {
  itDb('POST /api/attachments/upload → 403, no attachment row created', async () => {
    sessionState.current = demoSession();
    const before = (await db.query.attachments.findMany({ where: eq(schema.attachments.patientId, demoPatient) })).length;

    const mod = await import('@/app/api/attachments/upload/route');
    const req = new Request('http://localhost/api/attachments/upload', {
      method: 'POST',
      body: 'ignored — guard fires before the body is read',
    });
    const res = await mod.POST(req as never);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(MSG);

    const after = (await db.query.attachments.findMany({ where: eq(schema.attachments.patientId, demoPatient) })).length;
    expect(after).toBe(before);
  });

  itDb('POST /api/patients/[id]/email-history → 403, no email sent', async () => {
    sessionState.current = demoSession();
    authMocks.sendPatientHistoryEmail.mockClear();

    const mod = await import('@/app/api/patients/[id]/email-history/route');
    const req = new Request(`http://localhost/api/patients/${demoPatient}/email-history`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipient_email: 'attacker@example.com', confirmed_patient_authorization: true }),
    });
    const res = await mod.POST(req as never, { params: Promise.resolve({ id: demoPatient }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(MSG);
    expect(authMocks.sendPatientHistoryEmail).not.toHaveBeenCalled();
  });
});
