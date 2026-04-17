import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { loginSchema } from '@/lib/validators/auth';
import { getDummyHash, verifyPassword } from '@/lib/auth/password';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth/tokens';
import { setAuthCookies } from '@/lib/auth/cookies';
import { safeAuditLog } from '@/lib/audit';
import {
  checkLoginRateLimit,
  registerLoginFailure,
  resetLoginAttempts,
} from '@/lib/auth/rate-limit';

function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return null;
}

// If no trusted client IP is available, we MUST NOT bucket every caller under
// a shared 'unknown' key (would let one attacker lock out everyone, or let any
// caller in dev trivially DoS login). Fall back to the email so failed attempts
// are scoped to a single target account.
function rateLimitKey(ip: string | null, email: string): string {
  if (ip) return `ip:${ip}`;
  return `email:${email.toLowerCase()}`;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Email o contraseña inválidos' },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const ip = getClientIp(request);
  const rlKey = rateLimitKey(ip, normalizedEmail);

  const rate = checkLoginRateLimit(rlKey);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
      },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  // Always run argon2id verification — against the real hash if the user exists
  // or a dummy hash otherwise — so response time does not reveal whether the
  // email is registered. Collapse all failure cases (missing user, inactive
  // user, wrong password) into the same generic 401.
  const hashToVerify = user?.passwordHash ?? (await getDummyHash());
  const passwordOk = await verifyPassword(hashToVerify, password);

  if (!user || !user.isActive || !passwordOk) {
    const after = registerLoginFailure(rlKey);
    // If this failed attempt pushed the bucket over the limit, switch to 429
    // so status code stays consistent with the pre-auth rate-limit branch.
    // Genuine bad credentials that still have attempts left stay as 401.
    if (!after.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
        },
        {
          status: 429,
          headers: { 'Retry-After': String(after.retryAfterSeconds) },
        },
      );
    }
    return NextResponse.json(
      { success: false, error: 'Email o contraseña incorrectos' },
      { status: 401 },
    );
  }

  resetLoginAttempts(rlKey);

  const claims = { userId: user.id, clinicId: user.clinicId, role: user.role };
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(claims),
    generateRefreshToken(claims),
  ]);

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  // Audit failure must NOT prevent the client from receiving its auth cookies.
  // A dropped audit entry is recoverable; a hung login is not.
  await safeAuditLog({
    clinicId: user.clinicId,
    userId: user.id,
    action: 'LOGIN',
    resourceType: 'user',
    resourceId: user.id,
    ipAddress: ip ?? undefined,
  });

  const response = NextResponse.json({
    success: true,
    data: {
      userId: user.id,
      fullName: user.fullName,
      role: user.role,
    },
  });
  setAuthCookies(response, { accessToken, refreshToken });
  return response;
}
