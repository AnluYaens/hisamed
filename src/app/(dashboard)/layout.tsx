import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { Menu, Stethoscope } from 'lucide-react';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { LogoutButton } from '@/components/logout-button';
import { SidebarNav } from '@/components/sidebar-nav';
import { MobileSidebar } from '@/components/mobile-sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  doctor: 'Médico',
  receptionist: 'Recepcionista',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { fullName: true, role: true, email: true },
  });

  if (!user) redirect('/login');

  const roleLabel = roleLabels[user.role] ?? user.role;

  return (
    <div className="flex h-full">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Stethoscope className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            ClinicaMVP
          </span>
        </div>
        <Separator />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav role={user.role} />
        </div>
        <Separator />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {getInitials(user.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {user.fullName}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{roleLabel}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Top header ── */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 lg:px-6">
          {/* Mobile hamburger */}
          <MobileSidebar role={user.role}>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 lg:hidden"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
          </MobileSidebar>

          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {user.fullName}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{roleLabel}</span>
            </div>
            <Avatar className="h-8 w-8 lg:hidden">
              <AvatarFallback className="bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {getInitials(user.fullName)}
              </AvatarFallback>
            </Avatar>
            <LogoutButton />
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-900">
          {children}
        </main>
      </div>
    </div>
  );
}
