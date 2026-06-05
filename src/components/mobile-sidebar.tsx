'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SidebarNav } from '@/components/sidebar-nav';
import { BrandLogo } from '@/components/brand-logo';
import { requestLogout, logoutDestination } from '@/lib/auth/logout-client';
import type { UserRole } from '@/lib/db/schema';

interface MobileSidebarProps {
  role: UserRole;
  isDemo?: boolean;
  children: React.ReactNode;
}

export function MobileSidebar({ role, isDemo = false, children }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Logout lives in the sidebar on mobile (the top bar dropped it to save
  // space). Reuses the shared logout action — see `logout-client.ts`.
  async function onLogout() {
    await requestLogout();
    setOpen(false);
    const destination = logoutDestination(isDemo);
    startTransition(() => {
      router.replace(destination);
      router.refresh();
    });
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{children}</span>
      <Sheet open={open} onOpenChange={(value) => setOpen(value)}>
        <SheetContent
          side="left"
          className="w-72 border-slate-900/6 bg-white/80 p-0 text-slate-700 backdrop-blur-2xl"
        >
          <SheetHeader className="flex h-16 flex-row items-center border-b border-slate-900/6 px-5 space-y-0">
            <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
            <BrandLogo size="sm" />
          </SheetHeader>
          {/* Nav scrolls; the logout footer stays pinned to the bottom. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNav role={role} onNavigate={() => setOpen(false)} />
          </div>
          <div className="shrink-0 border-t border-slate-900/6 p-3">
            <button
              type="button"
              onClick={onLogout}
              disabled={pending}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-slate-600 transition-[background,color] duration-200 hover:bg-slate-900/5 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 disabled:opacity-60"
            >
              <LogOut className="h-4.5 w-4.5 shrink-0 text-slate-400 transition-colors group-hover:text-slate-700" />
              {pending ? 'Saliendo...' : 'Cerrar sesión'}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
