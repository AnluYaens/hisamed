'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const inputClass =
  'flex h-12 w-full rounded-[14px] border border-slate-900/10 bg-white/85 px-4 text-[14.5px] text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background] placeholder:text-slate-400 focus-visible:border-teal-600/50 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/16 disabled:cursor-not-allowed disabled:opacity-50';

// Only accept same-origin absolute paths. Reject protocol-relative URLs
// (`//evil.com`, `/\evil.com`) that browsers treat as cross-origin, and any
// path that doesn't start with a single `/`. Prevents open-redirect phishing
// via crafted `/login?redirect=...` links.
function safeRedirectTarget(raw: string | null): string {
  const FALLBACK = '/';
  if (!raw) return FALLBACK;
  if (raw.length > 512) return FALLBACK;
  if (!raw.startsWith('/')) return FALLBACK;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return FALLBACK;
  return raw;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = submitting || pending;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Re-entry guard: prevents double-submit while the request is in flight
    // (the `disabled` attr alone is not enough because state updates are async
    // and rapid Enter-key presses can race).
    if (busy) return;

    setError(null);
    setSubmitting(true);

    let res: Response;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      // Network failure (offline, DNS, server unreachable, CORS, adblocker).
      // Must be caught here; otherwise the promise rejection is silent and the
      // user sees no feedback. `res` is never assigned on this path.
      setError('No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.');
      setSubmitting(false);
      return;
    }

    let payload: { success: boolean; error?: string } = { success: false };
    try {
      payload = await res.json();
    } catch {
      // Malformed body; keep payload as the default failure shape and rely on
      // res.ok / generic error below.
    }

    if (!res.ok || !payload.success) {
      setError(payload.error ?? 'No se pudo iniciar sesión');
      setSubmitting(false);
      return;
    }

    // Success: leave `submitting` true until the client-side navigation
    // completes so the form cannot be resubmitted in the brief window before
    // the page unmounts.
    const target = safeRedirectTarget(searchParams.get('redirect'));
    startTransition(() => {
      router.replace(target);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-[13px] font-semibold text-slate-700">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          disabled={busy}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-[13px] font-semibold text-slate-700">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          disabled={busy}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-red-600/20 bg-red-100/80 px-3.5 py-3 text-[13.5px] text-red-700 backdrop-blur-[12px]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={busy}
        className="h-11 w-full text-sm"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Ingresando…
          </>
        ) : (
          'Ingresar'
        )}
      </Button>
    </form>
  );
}
