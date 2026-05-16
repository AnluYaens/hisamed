'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, CalendarDays, Settings, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/db/schema';
import { canAccessReports } from '@/lib/reports/access';
import { MedicalToolsDrawer } from '@/components/medical-tools/medical-tools-drawer';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  /** When set, the item only renders for these roles. */
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/pacientes', label: 'Pacientes', icon: Users },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['admin', 'doctor'] },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];

interface SidebarNavProps {
  role: UserRole;
  onNavigate?: () => void;
}

export function SidebarNav({ role, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true;
    if (item.href === '/reportes') return canAccessReports(role);
    return item.roles.includes(role);
  });

  return (
    <nav className="flex flex-col gap-1 p-3">
      {visibleItems.map(({ href, label, icon: Icon }) => {
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
