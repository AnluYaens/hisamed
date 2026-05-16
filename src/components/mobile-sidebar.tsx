'use client';

import { useState } from 'react';
import { Stethoscope } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SidebarNav } from '@/components/sidebar-nav';
import { Separator } from '@/components/ui/separator';
import type { UserRole } from '@/lib/db/schema';

interface MobileSidebarProps {
  role: UserRole;
  children: React.ReactNode;
}

export function MobileSidebar({ role, children }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span onClick={() => setOpen(true)}>{children}</span>
      <Sheet open={open} onOpenChange={(value) => setOpen(value)}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="flex h-16 flex-row items-center gap-2.5 px-5 space-y-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Stethoscope className="h-4 w-4 text-white" />
            </div>
            <SheetTitle className="text-sm font-semibold tracking-tight">ClinicaMVP</SheetTitle>
          </SheetHeader>
          <Separator />
          <SidebarNav role={role} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
