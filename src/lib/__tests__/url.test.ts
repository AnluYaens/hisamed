import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { getBaseUrl, absoluteUrl } from '../url';

// getBaseUrl only ever reads `request.url`, so a minimal stub is enough.
function fakeRequest(url: string): NextRequest {
  return { url } as NextRequest;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getBaseUrl', () => {
  it('returns the env value when set', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://hisamed.com');
    expect(getBaseUrl()).toBe('https://hisamed.com');
  });

  it('strips a trailing slash from the env value', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://hisamed.com/');
    expect(getBaseUrl()).toBe('https://hisamed.com');
  });

  it('strips multiple trailing slashes from the env value', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://hisamed.com///');
    expect(getBaseUrl()).toBe('https://hisamed.com');
  });

  it('prefers the env value over the request origin', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://hisamed.com');
    expect(getBaseUrl(fakeRequest('http://0.0.0.0:3000/demo'))).toBe(
      'https://hisamed.com',
    );
  });

  it('falls back to the request origin when env is unset and a request is provided', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    expect(getBaseUrl(fakeRequest('http://0.0.0.0:3000/demo?x=1'))).toBe(
      'http://0.0.0.0:3000',
    );
  });

  it('falls back to localhost when both env and request are unset', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    expect(getBaseUrl()).toBe('http://localhost:3000');
  });
});

describe('absoluteUrl', () => {
  it('appends the path to the env base URL', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://hisamed.com');
    expect(absoluteUrl('/inicio')).toBe('https://hisamed.com/inicio');
  });

  it('joins cleanly when the env value has a trailing slash', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://hisamed.com/');
    expect(absoluteUrl('/?demo=unavailable')).toBe(
      'https://hisamed.com/?demo=unavailable',
    );
  });

  it('uses the request origin as the base when env is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    expect(absoluteUrl('/login', fakeRequest('http://0.0.0.0:3000/'))).toBe(
      'http://0.0.0.0:3000/login',
    );
  });
});
