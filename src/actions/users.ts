'use server';

import { and, eq, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { users, clinics } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/session';
import { isDemoSession, demoWriteBlocked } from '@/lib/auth/demo';
import { auditLog, getClientIpFromHeaders } from '@/lib/audit';
import { hashPassword } from '@/lib/auth/password';
import { generateId } from '@/lib/utils/generate-id';
import {
  userCreateSchema,
  userUpdateSchema,
  resetPasswordSchema,
} from '@/lib/validators/user';
import { getUserById } from '@/queries/users';
import { formFailure, type FormFailure } from '@/lib/forms/state';

export type UserActionState = null | { success: true } | FormFailure;

// ─── createUser ───────────────────────────────────────────────────────────────

export async function createUser(
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  let session;
  try {
    session = await requireRole(['admin', 'doctor']);
  } catch {
    return { success: false, error: 'No tienes permisos para crear usuarios' };
  }

  if (isDemoSession(session)) return demoWriteBlocked();

  const raw = Object.fromEntries(formData.entries());
  const parsed = userCreateSchema.safeParse(raw);

  if (!parsed.success) {
    return formFailure(formData, {
      error: 'Revisa los datos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const { email, password, full_name, role } = parsed.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.clinicId, session.clinicId), eq(users.email, email)))
    .limit(1);

  if (existing.length > 0) {
    return formFailure(formData, {
      error: `Ya existe un usuario con el email ${email}`,
      fieldErrors: { email: ['Ya existe un usuario con este email'] },
    });
  }

  if (role === 'doctor') {
    const [clinicRow] = await db
      .select({ maxDoctors: clinics.maxDoctors })
      .from(clinics)
      .where(eq(clinics.id, session.clinicId))
      .limit(1);
    if (clinicRow) {
      const [{ total }] = await db
        .select({ total: count() })
        .from(users)
        .where(and(eq(users.clinicId, session.clinicId), eq(users.role, 'doctor')));
      if (total >= clinicRow.maxDoctors) {
        return formFailure(formData, {
          error: `Has alcanzado el límite de médicos de tu plan (${clinicRow.maxDoctors}). Actualiza tu plan para agregar más médicos.`,
        });
      }
    }
  }

  const passwordHash = await hashPassword(password);
  const userId = generateId();

  await db.insert(users).values({
    id: userId,
    clinicId: session.clinicId,
    email,
    passwordHash,
    fullName: full_name,
    role,
  });

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'CREATE',
    resourceType: 'user',
    resourceId: userId,
    details: { email, role },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath('/configuracion/usuarios');
  return { success: true };
}

// ─── updateUser ───────────────────────────────────────────────────────────────

export async function updateUser(
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  let session;
  try {
    session = await requireRole(['admin', 'doctor']);
  } catch {
    return { success: false, error: 'No tienes permisos para editar usuarios' };
  }

  if (isDemoSession(session)) return demoWriteBlocked();

  const raw = Object.fromEntries(formData.entries());
  const parsed = userUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    return formFailure(formData, {
      error: 'Revisa los datos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const { user_id, full_name, role, is_active } = parsed.data;

  const existing = await getUserById(session.clinicId, user_id);
  if (!existing) {
    return formFailure(formData, { error: 'Usuario no encontrado' });
  }

  if (user_id === session.userId && role !== undefined && role !== existing.role) {
    return formFailure(formData, { error: 'No puedes cambiar tu propio rol' });
  }

  if (is_active === false && user_id === session.userId) {
    return formFailure(formData, { error: 'No puedes desactivarte a ti mismo' });
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (full_name !== undefined) updateData.fullName = full_name;
  if (role !== undefined) updateData.role = role;
  if (is_active !== undefined) updateData.isActive = is_active;

  await db
    .update(users)
    .set(updateData)
    .where(and(eq(users.id, user_id), eq(users.clinicId, session.clinicId)));

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'UPDATE',
    resourceType: 'user',
    resourceId: user_id,
    details: { fields: Object.keys(updateData).filter((k) => k !== 'updatedAt') },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath('/configuracion/usuarios');
  return { success: true };
}

// ─── resetUserPassword ────────────────────────────────────────────────────────

export async function resetUserPassword(
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  let session;
  try {
    session = await requireRole(['admin', 'doctor']);
  } catch {
    return { success: false, error: 'No tienes permisos para resetear contraseñas' };
  }

  if (isDemoSession(session)) return demoWriteBlocked();

  const raw = Object.fromEntries(formData.entries());
  const parsed = resetPasswordSchema.safeParse(raw);

  if (!parsed.success) {
    return formFailure(formData, {
      error: 'Revisa los datos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const { user_id, new_password } = parsed.data;

  const existing = await getUserById(session.clinicId, user_id);
  if (!existing) {
    return formFailure(formData, { error: 'Usuario no encontrado' });
  }

  const passwordHash = await hashPassword(new_password);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(and(eq(users.id, user_id), eq(users.clinicId, session.clinicId)));

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'UPDATE',
    resourceType: 'user',
    resourceId: user_id,
    details: { action: 'password_reset' },
    ipAddress: await getClientIpFromHeaders(),
  });

  return { success: true };
}
