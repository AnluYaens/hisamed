'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

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
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-foreground">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy} className="w-full" size="lg">
        {busy ? 'Ingresando...' : 'Ingresar'}
      </Button>
    </form>
  );
}
