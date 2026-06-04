'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function LogoutButton({ isDemo = false }: { isDemo?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function onClick() {
    await fetch('/api/auth/logout', { method: 'POST' });
    // Demo visitors arrived from the public landing page, so send them back
    // there on logout. Real users keep returning to the login screen.
    const destination = isDemo ? '/' : '/login';
    startTransition(() => {
      router.replace(destination);
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      {pending ? 'Saliendo...' : 'Cerrar sesión'}
    </Button>
  );
}
