'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, CalendarDays, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MedicalToolsDrawer } from '@/components/medical-tools/medical-tools-drawer';

const navItems = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/pacientes', label: 'Pacientes', icon: Users },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];

interface SidebarNavProps {
  onNavigate?: () => void;
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
      <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
      <MedicalToolsDrawer />
    </nav>
  );
}
