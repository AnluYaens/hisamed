// Next.js 16 renamed `middleware` to `proxy`. This file intentionally lives at
// `src/proxy.ts` (equivalent to the legacy `src/middleware.ts`).
// IMPORTANT: This is redirection only — permission checks MUST happen inside
// each Server Action and Route Handler via `getSession()` / `requireRole()`.
import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth/session';
import { absoluteUrl } from '@/lib/url';

const PUBLIC_PATHS = new Set<string>([
  // Marketing landing (root) + the demo auto-login entry point.
  '/',
  '/demo',
  '/login',
  '/forgot-password',
  '/registro',
  // Public legal documents (Spanish default + English).
  '/terminos',
  '/privacidad',
  '/dpa',
  '/terms',
  '/privacy',
  '/dpa-en',
]);

// Forward the pathname as a request header so server components (e.g. the
// dashboard layout) can read it via `headers().get('x-pathname')` without
// coupling to client-only APIs like usePathname().
function withPathname(request: NextRequest): NextResponse {
  return NextResponse.next({
    request: {
      headers: new Headers({
        ...Object.fromEntries(request.headers.entries()),
        'x-pathname': request.nextUrl.pathname,
      }),
    },
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Logged-in visitors landing on the marketing root are sent straight to the
  // dashboard home. Presence of the access cookie is sufficient here — the
  // dashboard layout still re-verifies the token server-side.
  if (pathname === '/' && request.cookies.has(ACCESS_COOKIE)) {
    return NextResponse.redirect(absoluteUrl('/inicio', request));
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return withPathname(request);
  }

  const hasAccessToken = request.cookies.has(ACCESS_COOKIE);
  if (hasAccessToken) {
    return withPathname(request);
  }

  const loginUrl = new URL(absoluteUrl('/login', request));
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
  //
  // The PWA assets (manifest, service worker, icons) are public, non-PHI static
  // metadata and MUST be fetchable without a session — the browser loads the
  // manifest (sometimes uncredentialed) and registers the SW from the login
  // page, so they cannot be behind the auth redirect.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js|icons).*)',
  ],
};
