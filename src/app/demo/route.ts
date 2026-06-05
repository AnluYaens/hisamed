import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth/tokens';
import { setAuthCookies } from '@/lib/auth/cookies';
import { DEMO_CLINIC_ID, DEMO_USER_ID, DEMO_LANG_COOKIE } from '@/lib/auth/demo';
import { isProd } from '@/lib/auth/cookies';
import { absoluteUrl } from '@/lib/url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Auto-login entry point for the public "Probar demo" button.
//
// SECURITY: this route accepts NO input and can only ever authenticate the one
// hardcoded demo user (matched by both its fixed id AND its clinic id). There
// is no code path here that could mint a session for any other account, so it
// cannot be abused as a generic login bypass. The minted session is read-only
// everywhere downstream via isDemoSession() guards (see src/lib/auth/demo.ts).
export async function GET(request: NextRequest) {
  const demoUser = await db.query.users.findFirst({
    where: and(
      eq(users.id, DEMO_USER_ID),
      eq(users.clinicId, DEMO_CLINIC_ID),
      eq(users.isActive, true),
    ),
    columns: { id: true, clinicId: true, role: true },
  });

  // The demo account has not been seeded (or was disabled). Fail closed by
  // sending the visitor back to the landing page rather than 500-ing.
  if (!demoUser) {
    return NextResponse.redirect(absoluteUrl('/?demo=unavailable', request));
  }

  const claims = {
    userId: demoUser.id,
    clinicId: demoUser.clinicId,
    role: demoUser.role,
  };
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(claims),
    generateRefreshToken(claims),
  ]);

  const response = NextResponse.redirect(absoluteUrl('/inicio', request));
  setAuthCookies(response, { accessToken, refreshToken });

  // Remember whether the visitor entered from the English landing so the demo
  // banner can add a one-line note about the app being Spanish-only. Only 'en'
  // is recorded; the default (Spanish) flow stays cookie-free and unchanged.
  if (request.nextUrl.searchParams.get('lang') === 'en') {
    response.cookies.set({
      name: DEMO_LANG_COOKIE,
      value: 'en',
      httpOnly: true,
      secure: isProd(),
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
  }

  return response;
}
