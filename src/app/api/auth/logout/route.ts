import { NextResponse, type NextRequest } from 'next/server';
import {
  verifyToken,
  type AccessTokenPayload,
  type RefreshTokenPayload,
} from '@/lib/auth/tokens';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth/session';
import { safeAuditLog } from '@/lib/audit';

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

// Try the access token first (short-lived, usually stale on logout). Fall back
// to the refresh token (7d) so we still audit logouts after the access token
// expired. Both must be cryptographically valid — we never trust an unverified
// JWT for audit, otherwise anyone could inject arbitrary userIds into the log.
async function identifyCaller(
  request: NextRequest,
): Promise<AccessTokenPayload | RefreshTokenPayload | null> {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  if (access) {
    try {
      return await verifyToken(access, 'access');
    } catch {
      // fall through to refresh token
    }
  }
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    try {
      return await verifyToken(refresh, 'refresh');
    } catch {
      // both invalid — skip audit
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const payload = await identifyCaller(request);
  if (payload) {
    // Audit failure must NOT leave the client logged in. Always clear cookies.
    await safeAuditLog({
      clinicId: payload.clinicId,
      userId: payload.sub,
      action: 'LOGOUT',
      resourceType: 'user',
      resourceId: payload.sub,
      ipAddress: getClientIp(request) ?? undefined,
    });
  }

  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  return response;
}
