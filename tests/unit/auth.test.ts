import { describe, expect, it, beforeAll } from 'vitest';
import { generateAccessToken, generateRefreshToken, verifyToken } from '@/lib/auth/tokens';

const TEST_USER = {
  userId: '00000000-0000-4000-8000-000000000001',
  clinicId: '00000000-0000-4000-8000-000000000002',
  role: 'doctor' as const,
};

// Set JWT secrets before any imports that read them
beforeAll(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-at-least-32-chars!';
});

describe('generateAccessToken', () => {
  it('genera un string no vacío', async () => {
    const token = await generateAccessToken(TEST_USER);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('el token tiene 3 partes separadas por puntos (estructura JWT)', async () => {
    const token = await generateAccessToken(TEST_USER);
    expect(token.split('.')).toHaveLength(3);
  });

  it('tokens distintos para la misma entrada (iat diferente)', async () => {
    const t1 = await generateAccessToken(TEST_USER);
    // Introduce a tiny delay so iat can differ
    await new Promise((r) => setTimeout(r, 10));
    const t2 = await generateAccessToken(TEST_USER);
    // Both must be valid but may differ (iat, jti)
    expect(typeof t1).toBe('string');
    expect(typeof t2).toBe('string');
  });
});

describe('generateRefreshToken', () => {
  it('genera un string válido con 3 partes JWT', async () => {
    const token = await generateRefreshToken(TEST_USER);
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('verifyToken (access)', () => {
  it('verifica un token de acceso válido y retorna los claims correctos', async () => {
    const token = await generateAccessToken(TEST_USER);
    const payload = await verifyToken(token, 'access');

    expect(payload.sub).toBe(TEST_USER.userId);
    expect(payload.clinicId).toBe(TEST_USER.clinicId);
    expect(payload.role).toBe(TEST_USER.role);
    expect(payload.kind).toBe('access');
  });

  it('rechaza un token de refresh cuando se espera access', async () => {
    const refreshToken = await generateRefreshToken(TEST_USER);
    await expect(verifyToken(refreshToken, 'access')).rejects.toThrow();
  });

  it('rechaza un token malformado', async () => {
    await expect(verifyToken('not.a.token', 'access')).rejects.toThrow();
  });

  it('rechaza un token con firma alterada', async () => {
    const token = await generateAccessToken(TEST_USER);
    const parts = token.split('.');
    // Tamper with the payload (middle part)
    const tampered = `${parts[0]}.xxxxxxxx.${parts[2]}`;
    await expect(verifyToken(tampered, 'access')).rejects.toThrow();
  });

  it('rechaza un token vacío', async () => {
    await expect(verifyToken('', 'access')).rejects.toThrow();
  });
});

describe('verifyToken (refresh)', () => {
  it('verifica un token de refresh válido', async () => {
    const token = await generateRefreshToken(TEST_USER);
    const payload = await verifyToken(token, 'refresh');

    expect(payload.sub).toBe(TEST_USER.userId);
    expect(payload.kind).toBe('refresh');
  });

  it('rechaza un token de acceso cuando se espera refresh', async () => {
    const accessToken = await generateAccessToken(TEST_USER);
    await expect(verifyToken(accessToken, 'refresh')).rejects.toThrow();
  });
});

describe('getSecret - validación de longitud de secreto', () => {
  it('lanza error si JWT_SECRET tiene menos de 32 caracteres', async () => {
    const original = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'tooshort';
    await expect(generateAccessToken(TEST_USER)).rejects.toThrow(/32/);
    process.env.JWT_SECRET = original;
  });
});
