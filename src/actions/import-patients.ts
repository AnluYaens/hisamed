'use server';

import { db } from '@/lib/db';
import { patients, medicalHistories } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/session';
import { isDemoSession, DEMO_READONLY_MESSAGE } from '@/lib/auth/demo';
import { auditLog, getClientIpFromHeaders } from '@/lib/audit';
import { generateId } from '@/lib/utils/generate-id';
import { checkDuplicateIdNumber } from '@/queries/patients';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const csvRowSchema = z.object({
  id_number: z.string().min(1, 'Cédula requerida'),
  id_type: z.enum(['cedula', 'passport', 'other']).default('cedula'),
  first_name: z.string().min(1, 'Nombre requerido'),
  last_name: z.string().min(1, 'Apellido requerido'),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe ser YYYY-MM-DD'),
  sex: z.enum(['F', 'M', 'other']),
  phone: z.string().optional(),
});

export interface CsvImportRow {
  id_number: string;
  id_type?: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string;
  phone?: string;
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  errors: ImportRowError[];
  error?: string;
}

export async function importPatients(rows: CsvImportRow[]): Promise<ImportResult> {
  let session;
  try {
    session = await requireRole(['admin', 'doctor']);
  } catch {
    return { success: false, imported: 0, errors: [], error: 'No tienes permisos para importar pacientes' };
  }

  if (isDemoSession(session)) {
    return { success: false, imported: 0, errors: [], error: DEMO_READONLY_MESSAGE };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, imported: 0, errors: [], error: 'No hay datos para importar' };
  }

  const ip = await getClientIpFromHeaders();
  let imported = 0;
  const errors: ImportRowError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const raw = rows[i];

    const parsed = csvRowSchema.safeParse(raw);
    if (!parsed.success) {
      const msgs = parsed.error.issues.map((e) => e.message).join(', ');
      errors.push({ row: rowNum, message: msgs });
      continue;
    }

    const data = parsed.data;

    const isDuplicate = await checkDuplicateIdNumber(session.clinicId, data.id_number);
    if (isDuplicate) {
      errors.push({ row: rowNum, message: `Cédula duplicada: ${data.id_number}` });
      continue;
    }

    try {
      const patientId = generateId();

      await db.transaction(async (tx) => {
        await tx.insert(patients).values({
          id: patientId,
          clinicId: session.clinicId,
          idNumber: data.id_number,
          idType: data.id_type,
          firstName: data.first_name,
          lastName: data.last_name,
          dateOfBirth: data.date_of_birth,
          sex: data.sex,
          phone: data.phone ?? null,
          createdBy: session.userId,
        });

        await tx.insert(medicalHistories).values({
          id: generateId(),
          patientId,
          updatedBy: session.userId,
        });
      });

      await auditLog({
        clinicId: session.clinicId,
        userId: session.userId,
        action: 'CREATE',
        resourceType: 'patient',
        resourceId: patientId,
        details: { source: 'csv_import', idNumber: data.id_number },
        ipAddress: ip,
      });

      imported++;
    } catch (err) {
      errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : 'Error al importar fila',
      });
    }
  }

  revalidatePath('/pacientes');
  return { success: true, imported, errors };
}
