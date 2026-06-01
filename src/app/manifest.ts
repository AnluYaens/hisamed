import type { MetadataRoute } from 'next';

// Web app manifest for installable-PWA support. Next serves this at
// `/manifest.webmanifest` and auto-injects the <link rel="manifest"> tag.
//
// Scope intentionally omitted → defaults to the manifest location ("/"),
// matching the service worker scope. No `description`-driven behavior here;
// this is purely the install metadata. Medical data caching is explicitly NOT
// configured (see public/sw.js).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hisamed',
    short_name: 'Hisamed',
    description:
      'Sistema de historia clínica electrónica para ginecología y medicina reproductiva',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0d9488', // teal-600 — app brand color
    lang: 'es',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
