'use client';

import { useEffect } from 'react';

/**
 * Registers the Hisamed service worker (`/sw.js`) at scope `/` once on mount.
 * Renders nothing. The worker only enables PWA install + static-asset caching
 * (see public/sw.js) — it does not cache medical data.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    // Register after the page has loaded so it never competes with the initial
    // render for bandwidth.
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch((err) => {
          // Non-fatal: the app works fine without the SW; install/offline
          // niceties simply won't be available.
          console.error('Service worker registration failed:', err);
        });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
