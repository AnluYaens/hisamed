import { cookies } from 'next/headers';
import type { UserRole } from '@/lib/db/schema';
import { verifyToken } from '@/lib/auth/tokens';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export interface Session {
  userId: string;
  clinicId: string;
  role: UserRole;
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = await verifyToken(token, 'access');
    return {
      userId: payload.sub,
      clinicId: payload.clinicId,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  return session;
}

export async function requireRole(allowedRoles: UserRole[]): Promise<Session> {
  const session = await requireSession();
  if (!allowedRoles.includes(session.role)) throw new Error('Sin permisos');
  return session;
}
