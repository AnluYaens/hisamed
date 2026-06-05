'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { requestLogout, logoutDestination } from '@/lib/auth/logout-client';

export function LogoutButton({ isDemo = false }: { isDemo?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function onClick() {
    await requestLogout();
    const destination = logoutDestination(isDemo);
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
