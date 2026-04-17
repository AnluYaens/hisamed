import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { patients, medicalHistories } from '@/lib/db/schema';

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
  isActive: boolean;
  createdAt: Date;
}

export async function getPatients(
  clinicId: string,
  { search, page = 1, limit = DEFAULT_LIMIT }: GetPatientsOptions = {},
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

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: patients.id,
        idNumber: patients.idNumber,
        idType: patients.idType,
        firstName: patients.firstName,
        lastName: patients.lastName,
        dateOfBirth: patients.dateOfBirth,
        sex: patients.sex,
        phone: patients.phone,
        email: patients.email,
        isActive: patients.isActive,
        createdAt: patients.createdAt,
      })
      .from(patients)
      .where(baseWhere)
      .orderBy(desc(patients.createdAt))
      .limit(limit)
      .offset(offset),

    db.select({ value: count() }).from(patients).where(baseWhere),
  ]);

  const totalPages = Math.max(1, Math.ceil(Number(total) / limit));

  return {
    items: rows as PatientListItem[],
    total: Number(total),
    page,
    limit,
    totalPages,
  };
}

export type PatientDetail = Awaited<ReturnType<typeof getPatientById>>;

export async function getPatientById(clinicId: string, patientId: string) {
  const row = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)),
    with: {
      medicalHistory: true,
    },
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
