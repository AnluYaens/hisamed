'use client';

import { useTransition } from 'react';
import { Eye } from 'lucide-react';

// Persistent banner shown on every dashboard page while logged in as the shared
// read-only demo account. The "Solicitar acceso" CTA leaves the demo (clears
// the session) before landing on the public access section — the marketing
// root redirects logged-in users straight to /inicio, so a demo visitor must
// log out first to reach the request form.
export function DemoBanner({ lang = 'es' }: { lang?: 'es' | 'en' }) {
  const [pending, startTransition] = useTransition();

  function solicitarAcceso() {
    startTransition(async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // Even if logout fails we still send them to the landing; worst case
        // the proxy bounces them back to /inicio and they can retry.
      }
      window.location.href = `/?lang=${lang}#acceso`;
    });
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-teal-200 bg-teal-50 px-4 py-2.5 text-[13px] text-teal-900 lg:px-6">
      <span className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" />
        <span>
          {lang === 'en'
            ? "Note: the app is in Spanish — Hisamed is built for Spanish-speaking doctors in Latin America. Demo data and changes won't be saved."
            : 'Estás viendo una cuenta de demostración. Los cambios no se guardarán.'}
        </span>
      </span>
      <button
        type="button"
        onClick={solicitarAcceso}
        disabled={pending}
        className="shrink-0 rounded-lg border border-teal-600/40 px-3 py-1 font-medium text-teal-800 transition-colors hover:bg-teal-600/10 disabled:opacity-60"
      >
        Solicitar acceso
      </button>
    </div>
  );
}
