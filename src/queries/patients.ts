import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { medicalHistories, patients, patientPartners } from '@/lib/db/schema';

const DEFAULT_LIMIT = 20;

// Escape LIKE/ILIKE metacharacters so user input is treated as literal text
// (otherwise `_` matches any char and `%` forces broad matches). Backslash
// must be escaped first because it's also the default LIKE escape char in
// Postgres.
function escapeLike(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/[%_]/g, (ch) => `\\${ch}`);
}

export interface GetPatientsOptions {
  search?: string;
  page?: number;
  limit?: number;
  /** Include pregnancy tracking data from medical history. Only true for admin/doctor. */
  includeObstetric?: boolean;
}

export interface PatientsPage {
  items: PatientListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PatientListItem {
  id: string;
  idNumber: string;
  idType: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  phone: string | null;
  email: string | null;
  avatarStorageKey: string | null;
  isActive: boolean;
  createdAt: Date;
  /** FUM from medical history specialty_data, null if none recorded. */
  fumDate: string | null;
  /** True when pregnancy_ended is set in specialty_data. */
  pregnancyEnded: boolean;
}

export async function getPatients(
  clinicId: string,
  { search, page = 1, limit = DEFAULT_LIMIT, includeObstetric = false }: GetPatientsOptions = {},
): Promise<PatientsPage> {
  const offset = (page - 1) * limit;

  const trimmed = search?.trim() ?? '';
  const pattern = trimmed.length > 0 ? `%${escapeLike(trimmed)}%` : null;
  const searchCondition = pattern
    ? or(
        ilike(patients.firstName, pattern),
        ilike(patients.lastName, pattern),
        ilike(patients.idNumber, pattern),
        ilike(patients.phone, pattern),
      )
    : undefined;

  const baseWhere = and(eq(patients.clinicId, clinicId), searchCondition);

  const baseSelect = {
    id: patients.id,
    idNumber: patients.idNumber,
    idType: patients.idType,
    firstName: patients.firstName,
    lastName: patients.lastName,
    dateOfBirth: patients.dateOfBirth,
    sex: patients.sex,
    phone: patients.phone,
    email: patients.email,
    avatarStorageKey: patients.avatarStorageKey,
    isActive: patients.isActive,
    createdAt: patients.createdAt,
  };

  const [[{ value: total }], rawRows] = await Promise.all([
    db.select({ value: count() }).from(patients).where(baseWhere),
    includeObstetric
      ? db
          .select({ ...baseSelect, medSpecialtyData: medicalHistories.specialtyData })
          .from(patients)
          .leftJoin(medicalHistories, eq(medicalHistories.patientId, patients.id))
          .where(baseWhere)
          .orderBy(desc(patients.createdAt))
          .limit(limit)
          .offset(offset)
      : db
          .select(baseSelect)
          .from(patients)
          .where(baseWhere)
          .orderBy(desc(patients.createdAt))
          .limit(limit)
          .offset(offset),
  ]);

  const totalPages = Math.max(1, Math.ceil(Number(total) / limit));

  const items: PatientListItem[] = rawRows.map((r) => {
    const sd =
      'medSpecialtyData' in r
        ? (r.medSpecialtyData as Record<string, unknown> | null)
        : null;
    return {
      id: r.id,
      idNumber: r.idNumber,
      idType: r.idType,
      firstName: r.firstName,
      lastName: r.lastName,
      dateOfBirth: r.dateOfBirth as string,
      sex: r.sex,
      phone: r.phone,
      email: r.email,
      avatarStorageKey: r.avatarStorageKey,
      isActive: r.isActive,
      createdAt: r.createdAt,
      fumDate: (sd?.last_menstrual_period as string | null | undefined) ?? null,
      pregnancyEnded: sd?.pregnancy_ended === true,
    };
  });

  return {
    items,
    total: Number(total),
    page,
    limit,
    totalPages,
  };
}

export type PatientDetail = Awaited<ReturnType<typeof getPatientById>>;

// Returns the patient row only — never embed `medicalHistory` here. The
// patient detail page is rendered for every role (incl. receptionist) and
// passes `patient` into a client component, which serializes the whole
// object into the RSC payload. Loading medical history through this query
// would ship clinical data to roles that aren't allowed to see it. Use
// `getMedicalHistory(patientId)` from queries/medical-history.ts instead —
// it has its own role gate (admin/doctor only).
export async function getPatientById(clinicId: string, patientId: string) {
  const row = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)),
  });

  return row ?? null;
}

export async function getPatientPartner(patientId: string) {
  const row = await db.query.patientPartners.findFirst({
    where: eq(patientPartners.patientId, patientId),
  });
  return row ?? null;
}

export async function checkDuplicateIdNumber(
  clinicId: string,
  idNumber: string,
  excludePatientId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.clinicId, clinicId),
        ilike(patients.idNumber, escapeLike(idNumber)),
      ),
    )
    .limit(1);

  if (rows.length === 0) return false;
  if (excludePatientId && rows[0].id === excludePatientId) return false;
  return true;
}
