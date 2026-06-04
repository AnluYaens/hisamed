// Single source of truth for the app's public base URL.
//
// WHY THIS EXISTS: inside Next.js route handlers and the proxy, `request.url`
// reflects the internal Node bind address (e.g. http://0.0.0.0:3000) rather
// than the public hostname, even when the reverse proxy (Caddy) forwards
// X-Forwarded-Host correctly. Building a redirect from `new URL(path,
// request.url)` therefore sends the browser to the bind address in production.
//
// The fix is to anchor every browser-facing absolute URL on a configured
// public origin (NEXT_PUBLIC_APP_URL) instead of the request.

import type { NextRequest } from 'next/server';

const FALLBACK_BASE_URL = 'http://localhost:3000';

/**
 * Returns the public base URL (origin, no trailing slash) for building
 * absolute, browser-facing URLs.
 *
 * Resolution order:
 *  1. `NEXT_PUBLIC_APP_URL` — the production hostname (set in .env). Any
 *     trailing slash is stripped so paths can be appended with a leading `/`.
 *  2. The origin of `request.url`, when a NextRequest is provided and the env
 *     var is unset. Dev convenience only — do not rely on this in production,
 *     where `request.url` is the internal bind address.
 *  3. `http://localhost:3000` as a last resort.
 */
export function getBaseUrl(request?: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }

  if (request) {
    return new URL(request.url).origin;
  }

  return FALLBACK_BASE_URL;
}

/**
 * Builds an absolute URL by appending `path` to the public base URL. This is
 * the standard way to construct browser-facing absolute URLs (redirects, email
 * links) across the codebase.
 *
 * `path` should begin with a leading slash, e.g. `absoluteUrl('/inicio')`.
 */
export function absoluteUrl(path: string, request?: NextRequest): string {
  return `${getBaseUrl(request)}${path}`;
}
