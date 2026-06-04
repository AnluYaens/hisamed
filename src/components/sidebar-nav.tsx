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
  /** Items in the "config" group render below a separator. */
  group?: 'primary' | 'config';
}

const navItems: NavItem[] = [
  { href: '/inicio', label: 'Inicio', icon: Home, group: 'primary' },
  { href: '/pacientes', label: 'Pacientes', icon: Users, group: 'primary' },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays, group: 'primary' },
  { href: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['admin', 'doctor'], group: 'primary' },
  { href: '/configuracion', label: 'Configuración', icon: Settings, group: 'config' },
];

interface SidebarNavProps {
  role: UserRole;
  onNavigate?: () => void;
}

function NavLink({
  item,
  isActive,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  const { href, label, icon: Icon } = item;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-[background,color] duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40',
        // Vision drops the left bar — the pill background carries the state.
        isActive
          ? 'bg-teal-600/10 text-teal-800 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.12)]'
          : 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900',
      )}
    >
      <Icon
        className={cn(
          'h-4.5 w-4.5 shrink-0 transition-colors',
          isActive ? 'text-teal-700' : 'text-slate-400 group-hover:text-slate-700',
        )}
      />
      {label}
    </Link>
  );
}

export function SidebarNav({ role, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true;
    if (item.href === '/reportes') return canAccessReports(role);
    return item.roles.includes(role);
  });

  const isItemActive = (href: string) =>
    href === '/inicio' ? pathname === '/inicio' : pathname.startsWith(href);

  const primary = visibleItems.filter((i) => i.group === 'primary');
  const config = visibleItems.filter((i) => i.group === 'config');

  return (
    <nav className="flex flex-col gap-1 p-3">
      <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        Menú
      </p>
      {primary.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          isActive={isItemActive(item.href)}
          onNavigate={onNavigate}
        />
      ))}

      <div className="my-3 h-px bg-slate-900/6" />

      <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        Sistema
      </p>
      {config.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          isActive={isItemActive(item.href)}
          onNavigate={onNavigate}
        />
      ))}
      <MedicalToolsDrawer />
    </nav>
  );
}
