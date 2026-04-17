import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { UserRole } from '@/lib/db/schema';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';
const ISSUER = 'clinicamvp';
const AUDIENCE = 'clinicamvp-web';

export type TokenKind = 'access' | 'refresh';

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  clinicId: string;
  role: UserRole;
  kind: 'access';
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string;
  clinicId: string;
  role: UserRole;
  kind: 'refresh';
}

function getSecret(kind: TokenKind): Uint8Array {
  const raw = kind === 'access' ? process.env.JWT_SECRET : process.env.JWT_REFRESH_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      `Missing or too-short ${kind === 'access' ? 'JWT_SECRET' : 'JWT_REFRESH_SECRET'} (min 32 chars)`,
    );
  }
  return new TextEncoder().encode(raw);
}

interface TokenClaims {
  userId: string;
  clinicId: string;
  role: UserRole;
}

export async function generateAccessToken(claims: TokenClaims): Promise<string> {
  return new SignJWT({
    clinicId: claims.clinicId,
    role: claims.role,
    kind: 'access',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(getSecret('access'));
}

export async function generateRefreshToken(claims: TokenClaims): Promise<string> {
  return new SignJWT({
    clinicId: claims.clinicId,
    role: claims.role,
    kind: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(getSecret('refresh'));
}

export async function verifyToken<K extends TokenKind>(
  token: string,
  kind: K,
): Promise<K extends 'access' ? AccessTokenPayload : RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(kind), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (payload.kind !== kind) {
    throw new Error('Invalid token kind');
  }
  // Narrowing handled by generic return type.
  return payload as K extends 'access' ? AccessTokenPayload : RefreshTokenPayload;
}
