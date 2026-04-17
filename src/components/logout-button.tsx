'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function onClick() {
    await fetch('/api/auth/logout', { method: 'POST' });
    startTransition(() => {
      router.replace('/login');
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      {pending ? 'Saliendo...' : 'Cerrar sesión'}
    </Button>
  );
}
