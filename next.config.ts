import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

// Pragmatic baseline CSP that does not break Next.js' inline runtime scripts /
// styles. `frame-ancestors 'none'` gives modern browsers an extra clickjacking
// gate on top of X-Frame-Options below.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'" + (isProd ? '' : " 'unsafe-eval'"),
  "connect-src 'self'",
];
const CSP = CSP_DIRECTIVES.join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy', value: CSP },
  ...(isProd
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: 'standalone',
  // pdfkit reads its bundled AFM font files from disk at runtime. Bundling it
  // through webpack/turbopack breaks the lookup, so it must run as an external
  // CJS package inside the Node.js runtime where the route handlers execute.
  serverExternalPackages: ['pdfkit'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // The service worker must never be cached (so updates roll out
        // immediately) and is served from the root with scope "/".
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
