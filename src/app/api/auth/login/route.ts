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
  checkRateLimit,
  consumeRateLimit,
  clearRateLimit,
  type RateLimitSpec,
} from '@/lib/rate-limit';

// Brute-force window: per-IP and per-(email+IP) caps over 10 minutes.
const LOGIN_WINDOW_SECONDS = 10 * 60;
const PER_IP_LIMIT = 10;
const PER_EMAIL_IP_LIMIT = 5;

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

// Build the rate-limit specs for this attempt. When a trusted client IP is
// available we cap both the IP and the (email+IP) pair. When it is NOT, we
// MUST NOT bucket every caller under a shared 'unknown' IP key — that would
// let one attacker lock out everyone, or let any caller trivially DoS login.
// In that case we fall back to an email-only key so failures stay scoped to
// the single target account. Raw IP/email never reach the DB: the helper
// SHA-256-hashes every key before storing it.
function loginRateLimitSpecs(ip: string | null, email: string): RateLimitSpec[] {
  if (ip) {
    return [
      { key: `login:ip:${ip}`, limit: PER_IP_LIMIT, windowSeconds: LOGIN_WINDOW_SECONDS },
      {
        key: `login:email-ip:${email}:${ip}`,
        limit: PER_EMAIL_IP_LIMIT,
        windowSeconds: LOGIN_WINDOW_SECONDS,
      },
    ];
  }
  return [
    { key: `login:email:${email}`, limit: PER_EMAIL_IP_LIMIT, windowSeconds: LOGIN_WINDOW_SECONDS },
  ];
}

const TOO_MANY_ATTEMPTS = 'Demasiados intentos. Intenta de nuevo en unos minutos.';

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
  const rlSpecs = loginRateLimitSpecs(ip, normalizedEmail);

  // Read-only pre-check: block before verifying credentials so a locked-out
  // bucket never reaches argon2. The failure path below counts the attempt.
  for (const spec of rlSpecs) {
    const rate = await checkRateLimit(spec);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: TOO_MANY_ATTEMPTS },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      );
    }
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
    // Count this failed attempt against every bucket. We deliberately count
    // only failures so a user who eventually logs in is not penalised.
    const after = await Promise.all(rlSpecs.map((spec) => consumeRateLimit(spec)));
    // If this failure pushed any bucket over its limit, switch to 429 so the
    // status code stays consistent with the pre-auth rate-limit branch.
    // Genuine bad credentials that still have attempts left stay as 401.
    const exceeded = after.filter((r) => !r.allowed);
    if (exceeded.length > 0) {
      const retryAfter = Math.max(...exceeded.map((r) => r.retryAfterSeconds));
      return NextResponse.json(
        { success: false, error: TOO_MANY_ATTEMPTS },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }
    return NextResponse.json(
      { success: false, error: 'Email o contraseña incorrectos' },
      { status: 401 },
    );
  }

  // Successful login clears the failure buckets for this attempt's keys.
  await Promise.all(rlSpecs.map((spec) => clearRateLimit(spec.key)));

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
