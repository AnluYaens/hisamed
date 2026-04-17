import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { generateAccessToken, generateRefreshToken, verifyToken } from '@/lib/auth/tokens';
import { setAuthCookies, clearAuthCookies } from '@/lib/auth/cookies';
import { REFRESH_COOKIE } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'No hay refresh token' },
      { status: 401 },
    );
  }

  let payload;
  try {
    payload = await verifyToken(token, 'refresh');
  } catch {
    const response = NextResponse.json(
      { success: false, error: 'Refresh token inválido' },
      { status: 401 },
    );
    clearAuthCookies(response);
    return response;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.sub),
  });
  if (!user || !user.isActive || user.clinicId !== payload.clinicId) {
    const response = NextResponse.json(
      { success: false, error: 'Usuario no válido' },
      { status: 401 },
    );
    clearAuthCookies(response);
    return response;
  }

  const claims = { userId: user.id, clinicId: user.clinicId, role: user.role };
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(claims),
    generateRefreshToken(claims),
  ]);

  const response = NextResponse.json({ success: true });
  setAuthCookies(response, { accessToken, refreshToken });
  return response;
}
