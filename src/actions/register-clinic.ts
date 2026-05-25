'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clinics, users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth/tokens';
import { setAuthCookiesInAction } from '@/lib/auth/cookies';
import { generateId } from '@/lib/utils/generate-id';
import { enforceRateLimits } from '@/lib/rate-limit';
import { getClientIpFromHeaders } from '@/lib/audit';
import { registerClinicSchema, COUNTRY_TIMEZONES } from '@/lib/validators/register-clinic';
import { formFailure, type FormFailure } from '@/lib/forms/state';

export type RegisterState = null | FormFailure;

const REGISTRATION_WINDOW_SECONDS = 60 * 60;
const PER_IP_REGISTRATION_LIMIT = 5;

export async function registerClinic(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const raw = {
    clinicName: formData.get('clinicName'),
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    country: formData.get('country'),
    terms: formData.get('terms'),
  };

  const parsed = registerClinicSchema.safeParse(raw);
  if (!parsed.success) {
    return formFailure(formData, {
      error: 'Revisa los campos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const { clinicName, fullName, email, password, country } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const ip = await getClientIpFromHeaders();
  if (ip) {
    const rate = await enforceRateLimits([
      {
        key: `register:ip:${ip}`,
        limit: PER_IP_REGISTRATION_LIMIT,
        windowSeconds: REGISTRATION_WINDOW_SECONDS,
      },
    ]);
    if (!rate.allowed) {
      return formFailure(formData, {
        error: 'Demasiados intentos de registro. Intenta de nuevo en una hora.',
      });
    }
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    return formFailure(formData, {
      error: 'Este email ya está registrado',
      fieldErrors: { email: ['Este email ya está registrado'] },
    });
  }

  const timezone = COUNTRY_TIMEZONES[country] ?? 'America/Caracas';
  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const passwordHash = await hashPassword(password);
  const clinicId = generateId();
  const userId = generateId();

  await db.transaction(async (tx) => {
    await tx.insert(clinics).values({
      id: clinicId,
      name: clinicName,
      timezone,
      subscriptionStatus: 'trialing',
      trialEndsAt,
    });

    await tx.insert(users).values({
      id: userId,
      clinicId,
      email: normalizedEmail,
      passwordHash,
      fullName,
      role: 'doctor',
    });
  });

  const claims = { userId, clinicId, role: 'doctor' as const };
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(claims),
    generateRefreshToken(claims),
  ]);

  await setAuthCookiesInAction({ accessToken, refreshToken });

  redirect('/');
}
