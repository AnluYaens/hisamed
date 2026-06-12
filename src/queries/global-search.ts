import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clinicalNotes, patients } from '@/lib/db/schema';
import type { UserRole } from '@/lib/db/schema';
import {
  SEARCH_GROUP_LIMIT,
  SEARCH_MIN_LENGTH,
  type GlobalSearchResults,
  type NoteSearchHit,
  type PatientSearchHit,
} from '@/lib/search';

export {
  SEARCH_GROUP_LIMIT,
  SEARCH_MIN_LENGTH,
  type GlobalSearchResults,
  type NoteSearchHit,
  type PatientSearchHit,
} from '@/lib/search';

// ─── Global search ────────────────────────────────────────────────────────────
//
// Powers the Ctrl/Cmd+K command palette. Two security-critical invariants are
// enforced *here* in the query layer (not at the UI):
//
//   1. Clinic scope — every query filters on `patients.clinic_id` derived from
//      the caller's session. `clinical_notes` has no clinic column, so the
//      join through `patients` is what scopes notes.
//   2. Role gate — clinical-note search is admin/doctor only. A receptionist
//      query never touches `clinical_notes` (see `globalSearch`).
//
// Result payloads are intentionally minimal: no internal_notes, no storage
// keys, no R2 URLs, no raw note bodies. Note hits expose only a short snippet
// derived from the diagnosis/chief-complaint — `assessment` is searched but
// never returned.

/** Length cap for note snippets in the result payload. */
const SNIPPET_MAX = 90;

// Escape LIKE/ILIKE metacharacters so user input is treated as literal text.
// Backslash first — it's also the default LIKE escape char in Postgres.
function escapeLike(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/[%_]/g, (ch) => `\\${ch}`);
}

function searchTokens(input: string): string[] {
  return input
    .replace(/[,;]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function patientSearchCondition(tokens: string[]) {
  if (tokens.length === 0) return undefined;

  const fullName = sql<string>`concat_ws(' ', ${patients.firstName}, ${patients.lastName})`;
  const reversedFullName = sql<string>`concat_ws(' ', ${patients.lastName}, ${patients.firstName})`;

  return and(
    ...tokens.map((token) => {
      const pattern = `%${escapeLike(token)}%`;
      return or(
        ilike(patients.firstName, pattern),
        ilike(patients.lastName, pattern),
        ilike(patients.idNumber, pattern),
        ilike(patients.phone, pattern),
        sql`${fullName} ILIKE ${pattern}`,
        sql`${reversedFullName} ILIKE ${pattern}`,
      );
    }),
  );
}

function patientSearchRank(rawSearch: string) {
  const phrase = escapeLike(rawSearch.replace(/[,;]+/g, ' ').trim().replace(/\s+/g, ' '));
  const prefix = `${phrase}%`;
  const contains = `%${phrase}%`;
  const fullName = sql<string>`concat_ws(' ', ${patients.firstName}, ${patients.lastName})`;
  const reversedFullName = sql<string>`concat_ws(' ', ${patients.lastName}, ${patients.firstName})`;

  return sql<number>`case
    when ${fullName} ILIKE ${prefix} then 0
    when ${reversedFullName} ILIKE ${prefix} then 0
    when ${patients.firstName} ILIKE ${prefix} then 1
    when ${patients.lastName} ILIKE ${prefix} then 1
    when ${fullName} ILIKE ${contains} then 2
    when ${reversedFullName} ILIKE ${contains} then 2
    when ${patients.idNumber} ILIKE ${prefix} then 3
    else 4
  end`;
}

function truncate(text: string, max = SNIPPET_MAX): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

interface DiagnosisEntry {
  code?: string;
  text?: string;
}

const EMPTY_RESULTS: GlobalSearchResults = { patients: [], notes: [] };

// Indexing note (Phase 11.1 backlog): every query below is anchored on an
// equality filter on `patients.clinic_id`, which is the prefix column of the
// existing composite indexes (`patients_clinic_id_number_idx`,
// `patients_clinic_name_idx`, `patients_clinic_active_idx`). Postgres uses
// those to scan only the caller's clinic; the `ILIKE '%term%'` predicates
// then filter that already-small per-clinic set. Substring `ILIKE` itself
// cannot use a btree index — making it index-backed would require a `pg_trgm`
// GIN index (and enabling the extension) for patient fields, and for the
// `diagnoses::text` cast an expression index on top of that. That is a real
// infra change for a result set that is tiny and capped at SEARCH_GROUP_LIMIT,
// so it is intentionally deferred. Revisit if a single clinic ever holds
// enough patients/notes for the per-clinic scan to become slow.
async function searchPatientsFor(
  clinicId: string,
  rawQuery: string,
): Promise<PatientSearchHit[]> {
  const tokens = searchTokens(rawQuery);
  const searchCondition = patientSearchCondition(tokens);
  if (!searchCondition) return [];

  const rows = await db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      idNumber: patients.idNumber,
      phone: patients.phone,
    })
    .from(patients)
    .where(
      and(
        eq(patients.clinicId, clinicId),
        searchCondition,
      ),
    )
    .orderBy(asc(patientSearchRank(rawQuery)), asc(patients.lastName), asc(patients.firstName))
    .limit(SEARCH_GROUP_LIMIT);

  return rows.map((r) => ({
    type: 'patient' as const,
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    idNumber: r.idNumber,
    phone: r.phone,
  }));
}

async function searchNotesFor(
  clinicId: string,
  pattern: string,
): Promise<NoteSearchHit[]> {
  const rows = await db
    .select({
      id: clinicalNotes.id,
      patientId: clinicalNotes.patientId,
      noteDate: clinicalNotes.noteDate,
      chiefComplaint: clinicalNotes.chiefComplaint,
      diagnoses: clinicalNotes.diagnoses,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
    })
    .from(clinicalNotes)
    .innerJoin(patients, eq(clinicalNotes.patientId, patients.id))
    .where(
      and(
        eq(patients.clinicId, clinicId),
        or(
          ilike(clinicalNotes.chiefComplaint, pattern),
          ilike(clinicalNotes.assessment, pattern),
          // Diagnoses is a jsonb array of { code, text }. Cast to text for a
          // substring match on code + name. Not index-backed, but the result
          // set is tiny and capped at SEARCH_GROUP_LIMIT.
          sql`${clinicalNotes.diagnoses}::text ILIKE ${pattern}`,
        ),
      ),
    )
    .orderBy(desc(clinicalNotes.noteDate), desc(clinicalNotes.createdAt))
    .limit(SEARCH_GROUP_LIMIT);

  return rows.map((r) => {
    const diagnoses = Array.isArray(r.diagnoses)
      ? (r.diagnoses as DiagnosisEntry[])
      : [];
    const firstDiagnosis = diagnoses.find((d) => d.text?.trim())?.text ?? '';
    const snippetSource = firstDiagnosis || r.chiefComplaint || 'Nota clínica';
    return {
      type: 'note' as const,
      id: r.id,
      patientId: r.patientId,
      patientName: `${r.patientFirstName} ${r.patientLastName}`.trim(),
      noteDate: r.noteDate as string,
      snippet: truncate(snippetSource),
    };
  });
}

/**
 * Clinic-scoped, role-aware global search.
 *
 * @param clinicId  Always the caller's own clinic — never accept this from the
 *                  request body.
 * @param role      Receptionists get patient hits only; clinical-note search
 *                  is restricted to admin/doctor.
 * @param rawQuery  Raw user input. Searches run only at >= SEARCH_MIN_LENGTH
 *                  characters; shorter input returns empty groups.
 */
export async function globalSearch(
  clinicId: string,
  role: UserRole,
  rawQuery: string,
): Promise<GlobalSearchResults> {
  const query = rawQuery.trim();
  if (query.length < SEARCH_MIN_LENGTH) return EMPTY_RESULTS;

  const pattern = `%${escapeLike(query)}%`;
  const canSearchNotes = role === 'admin' || role === 'doctor';

  const [patientHits, noteHits] = await Promise.all([
    searchPatientsFor(clinicId, query),
    canSearchNotes ? searchNotesFor(clinicId, pattern) : Promise.resolve([]),
  ]);

  return { patients: patientHits, notes: noteHits };
}
