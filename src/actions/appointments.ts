'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { appointments } from '@/lib/db/schema';
import { requireSession } from '@/lib/auth/session';
import { isDemoSession, demoWriteBlocked } from '@/lib/auth/demo';
import { auditLog, getClientIpFromHeaders } from '@/lib/audit';
import { generateId } from '@/lib/utils/generate-id';
import {
  appointmentCreateSchema,
  appointmentStatusUpdateSchema,
  appointmentCancelSchema,
  VALID_TRANSITIONS,
  type AppointmentStatus,
} from '@/lib/validators/appointment';
import {
  checkOverlap,
  getAppointmentById,
} from '@/queries/appointments';
import { formFailure, type FormFailure } from '@/lib/forms/state';

export type AppointmentActionState =
  | null
  | { success: true; appointmentId?: string }
  | FormFailure;

// ─── createAppointment ────────────────────────────────────────────────────────

export async function createAppointment(
  _prevState: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { success: false, error: 'No autenticado' };
  }

  if (isDemoSession(session)) return demoWriteBlocked();

  const raw = Object.fromEntries(formData.entries());
  const parsed = appointmentCreateSchema.safeParse(raw);

  if (!parsed.success) {
    return formFailure(formData, {
      error: 'Revisa los datos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const data = parsed.data;
  const dateStr = data.date; // already YYYY-MM-DD per the validator
  const endTime = data.end_time || undefined;
  const appointmentId = generateId();

  // Run the overlap check + insert inside a single transaction protected by
  // a Postgres advisory lock keyed on (doctor, date). Without this, two
  // concurrent createAppointment calls could both pass `checkOverlap` (each
  // sees no conflict) and then both INSERT, ending up with overlapping
  // appointments. Advisory locks are released automatically at transaction
  // commit/rollback, so this only serializes the narrow window of writes
  // for the *same* doctor on the *same* day — uncontended writes are
  // unaffected.
  const result = await db.transaction(async (tx) => {
    const lockKey = `${data.doctor_id}:${dateStr}`;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);

    const overlaps = await checkOverlap(
      session!.clinicId,
      data.doctor_id,
      dateStr,
      data.start_time,
      endTime,
      undefined,
      tx,
    );

    if (overlaps) {
      return { success: false as const };
    }

    await tx.insert(appointments).values({
      id: appointmentId,
      clinicId: session!.clinicId,
      patientId: data.patient_id,
      doctorId: data.doctor_id,
      date: dateStr,
      startTime: data.start_time,
      endTime: endTime ?? null,
      status: 'scheduled',
      reason: data.reason ?? null,
      notes: data.notes ?? null,
      createdBy: session!.userId,
    });

    return { success: true as const };
  });

  if (!result.success) {
    return formFailure(formData, {
      error: 'El médico ya tiene una cita en ese horario. Por favor elige otro horario.',
      fieldErrors: { start_time: ['Horario ocupado'] },
    });
  }

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'CREATE',
    resourceType: 'appointment',
    resourceId: appointmentId,
    details: {
      patientId: data.patient_id,
      doctorId: data.doctor_id,
      date: dateStr,
      startTime: data.start_time,
    },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath('/agenda');
  redirect('/agenda');
}

// ─── updateAppointmentStatus ──────────────────────────────────────────────────

export async function updateAppointmentStatus(
  _prevState: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { success: false, error: 'No autenticado' };
  }

  if (isDemoSession(session)) return demoWriteBlocked();

  const raw = Object.fromEntries(formData.entries());
  const parsed = appointmentStatusUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { appointment_id, status: newStatus } = parsed.data;

  const existing = await getAppointmentById(session.clinicId, appointment_id);
  if (!existing) {
    return { success: false, error: 'Cita no encontrada' };
  }

  const currentStatus = existing.status as AppointmentStatus;
  const allowedNext = VALID_TRANSITIONS[currentStatus];

  if (!allowedNext.includes(newStatus as AppointmentStatus)) {
    return {
      success: false,
      error: `No se puede cambiar de "${currentStatus}" a "${newStatus}"`,
    };
  }

  await db
    .update(appointments)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(
      and(eq(appointments.id, appointment_id), eq(appointments.clinicId, session.clinicId)),
    );

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'UPDATE',
    resourceType: 'appointment',
    resourceId: appointment_id,
    details: { from: currentStatus, to: newStatus },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath('/agenda');
  revalidatePath(`/pacientes/${existing.patientId}`);

  return { success: true, appointmentId: appointment_id };
}

// ─── cancelAppointment ────────────────────────────────────────────────────────

export async function cancelAppointment(
  _prevState: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { success: false, error: 'No autenticado' };
  }

  if (isDemoSession(session)) return demoWriteBlocked();

  const raw = Object.fromEntries(formData.entries());
  const parsed = appointmentCancelSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos' };
  }

  const { appointment_id, reason } = parsed.data;

  const existing = await getAppointmentById(session.clinicId, appointment_id);
  if (!existing) {
    return { success: false, error: 'Cita no encontrada' };
  }

  if (existing.status === 'cancelled') {
    return { success: false, error: 'La cita ya está cancelada' };
  }

  const now = new Date();

  await db
    .update(appointments)
    .set({
      status: 'cancelled',
      cancelledAt: now,
      cancelledBy: session.userId,
      notes: reason
        ? `${existing.notes ?? ''}\n[Motivo de cancelación: ${reason}]`.trim()
        : existing.notes,
      updatedAt: now,
    })
    .where(
      and(eq(appointments.id, appointment_id), eq(appointments.clinicId, session.clinicId)),
    );

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'UPDATE',
    resourceType: 'appointment',
    resourceId: appointment_id,
    details: { action: 'cancel', reason: reason ?? null },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath('/agenda');
  revalidatePath(`/pacientes/${existing.patientId}`);

  return { success: true };
}
