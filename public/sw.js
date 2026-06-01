// Hisamed service worker — minimal, install-enabling only.
//
// SCOPE OF CACHING (deliberately narrow):
//   - Caches ONLY hashed static build assets and the PWA icons, for faster
//     repeat loads. These are immutable (content-hashed by Next), so a
//     cache-first strategy is safe.
//   - NEVER caches HTML/navigation responses or API responses. Medical data
//     must always come from the network — a stale clinical note or patient
//     record is a safety hazard. Those requests are left untouched (the SW
//     does not call respondWith), so the browser fetches them normally.
//
// This is NOT an offline-first worker. If the network is down, navigations and
// API calls fail as they normally would.

const CACHE = 'hisamed-static-v1';

// Match Next's immutable, content-hashed assets and our own static icons/
// fonts. Anything not matching here is served straight from the network.
function isCacheableStatic(url) {
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname;
  // Never cache the manifest itself or the SW — they must stay fresh.
  if (p === '/sw.js' || p === '/manifest.webmanifest') return false;
  if (p.startsWith('/_next/static/')) return true; // JS, CSS, hashed chunks
  if (p.startsWith('/icons/')) return true; // PWA icons
  return /\.(?:woff2?|ttf|otf|png|svg|jpg|jpeg|webp|ico)$/.test(p);
}

self.addEventListener('install', (event) => {
  // Activate the new worker immediately instead of waiting for all tabs to
  // close — there is no breaking cache contract to protect here.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older SW versions.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only ever touch GET requests for cacheable static assets. Everything else
  // — navigations (HTML), API calls, non-GET — falls through to the network
  // with no SW involvement.
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (!isCacheableStatic(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;

      const res = await fetch(req);
      // Only cache successful, basic (same-origin) responses.
      if (res.ok && res.type === 'basic') {
        cache.put(req, res.clone());
      }
      return res;
    })(),
  );
});
