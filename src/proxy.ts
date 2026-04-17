// Next.js 16 renamed `middleware` to `proxy`. This file intentionally lives at
// `src/proxy.ts` (equivalent to the legacy `src/middleware.ts`).
// IMPORTANT: This is redirection only — permission checks MUST happen inside
// each Server Action and Route Handler via `getSession()` / `requireRole()`.
import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth/session';

const PUBLIC_PATHS = new Set<string>(['/login', '/forgot-password']);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const hasAccessToken = request.cookies.has(ACCESS_COOKIE);
  if (hasAccessToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  const target = `${pathname}${request.nextUrl.search}`;
  if (target && target !== '/') {
    loginUrl.searchParams.set('redirect', target);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on all routes except Next internals, /api, static files, and metadata.
  // API route handlers enforce their own auth via `requireSession()` and must
  // return JSON (not an HTML redirect) on 401, so the proxy skips them entirely.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
