import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth/tokens';
import { setAuthCookies } from '@/lib/auth/cookies';
import { DEMO_CLINIC_ID, DEMO_USER_ID } from '@/lib/auth/demo';

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
    return NextResponse.redirect(new URL('/?demo=unavailable', request.url));
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

  const response = NextResponse.redirect(new URL('/inicio', request.url));
  setAuthCookies(response, { accessToken, refreshToken });
  return response;
}
