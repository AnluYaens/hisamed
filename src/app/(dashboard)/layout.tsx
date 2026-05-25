import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { Menu, AlertTriangle, Info, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { getClinicSubscription } from '@/queries/clinic';
import { LogoutButton } from '@/components/logout-button';
import { SidebarNav } from '@/components/sidebar-nav';
import { MobileSidebar } from '@/components/mobile-sidebar';
import { GlobalSearch } from '@/components/search/global-search';
import { ToastProvider } from '@/components/ui/toast';
import { BrandLogo } from '@/components/brand-logo';

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

const PLANS = [
  {
    key: 'basico',
    name: 'Básico',
    price: 'Próximamente',
    features: [
      'Ideal para empezar tu consulta',
      'Hasta 500 pacientes',
      '1 GB de almacenamiento',
    ],
  },
  {
    key: 'profesional',
    name: 'Profesional',
    price: 'Próximamente',
    features: [
      'Para una consulta establecida',
      'Hasta 2.000 pacientes',
      'Equipo de hasta 3 doctores',
      '5 GB de almacenamiento',
    ],
    highlight: true,
  },
  {
    key: 'clinica',
    name: 'Clínica',
    price: 'Próximamente',
    features: [
      'Para clínicas y prácticas grupales',
      'Pacientes ilimitados',
      'Doctores ilimitados',
      '20 GB de almacenamiento',
    ],
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const [user, subscription] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: { fullName: true, role: true, email: true },
    }),
    getClinicSubscription(session.clinicId),
  ]);

  if (!user) redirect('/login');

  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? '';
  const isConfigPage = pathname.startsWith('/configuracion');

  const roleLabel = roleLabels[user.role] ?? user.role;

  return (
    // Two frosted panels float over the ambient body backdrop, separated by a
    // 14px gutter. h-screen + flex-col keeps each panel exactly one viewport
    // tall so the sidebar never scrolls away its user block.
    <div className="flex h-screen gap-3.5 overflow-hidden p-3.5">
      {/* ── Desktop sidebar — light, frosted, floating ── */}
      <aside className="glass-panel hidden w-64 shrink-0 flex-col overflow-hidden lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-slate-900/6 px-5">
          <BrandLogo size="sm" />
        </div>
        {/* Nav scrolls on its own; min-h-0 lets it shrink inside the flex column. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav role={user.role} />
        </div>
        <div className="flex shrink-0 items-center gap-3 border-t border-slate-900/6 px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0D9488,#0F766E)] text-xs font-semibold text-white shadow-[0_4px_10px_-3px_rgba(13,148,136,0.45),inset_0_1px_0_rgba(255,255,255,0.25)]">
            {getInitials(user.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-900">
              {user.fullName}
            </p>
            <p className="text-[11px] text-slate-500">{roleLabel}</p>
          </div>
        </div>
      </aside>

      {/* ── Main area — frosted column ── */}
      <div className="glass-panel flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* ── Top header — translucent bar ── */}
        <header className="glass-header flex h-16 shrink-0 items-center gap-3 border-b border-slate-900/6 px-4 lg:px-6">
          {/* Mobile hamburger */}
          <MobileSidebar role={user.role}>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full p-2 text-zinc-500 transition-colors duration-150 hover:bg-slate-900/6 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 lg:hidden"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
          </MobileSidebar>

          <GlobalSearch />

          <div className="ml-auto flex items-center justify-end gap-3">
            <div className="hidden flex-col items-end leading-tight sm:flex">
              <span className="text-[13px] font-semibold text-zinc-900">
                {user.fullName}
              </span>
              <span className="text-[11px] text-zinc-500">{roleLabel}</span>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0D9488,#0F766E)] text-xs font-semibold text-white shadow-[0_4px_10px_-3px_rgba(13,148,136,0.45)]">
              {getInitials(user.fullName)}
            </span>
            <LogoutButton />
          </div>
        </header>

        {/* ── Trial banner ── */}
        {subscription.status === 'trialing' && !subscription.isTrialExpired && (
          <div
            className={[
              'flex shrink-0 items-center justify-between gap-3 px-4 py-2.5 text-[13px] lg:px-6',
              subscription.daysRemaining <= 3
                ? 'bg-amber-50 text-amber-800 border-b border-amber-200'
                : 'bg-sky-50 text-sky-800 border-b border-sky-200',
            ].join(' ')}
          >
            <span className="flex items-center gap-2">
              {subscription.daysRemaining <= 3 ? (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              ) : (
                <Info className="h-4 w-4 shrink-0" />
              )}
              <span>
                Estás en tu prueba gratuita.{' '}
                {subscription.daysRemaining === 1
                  ? 'Te queda 1 día.'
                  : `Te quedan ${subscription.daysRemaining} días.`}
              </span>
            </span>
            <Link
              href="/configuracion"
              className="shrink-0 rounded-lg border border-current/30 px-3 py-1 font-medium transition-colors hover:bg-black/5"
            >
              Ver planes
            </Link>
          </div>
        )}

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto">
          <ToastProvider>
            {subscription.isTrialExpired && !isConfigPage ? (
              <div className="flex min-h-full flex-col items-center justify-center gap-10 px-6 py-16">
                <div className="text-center">
                  <CreditCard className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                  <h1 className="text-2xl font-semibold text-slate-900">
                    Tu prueba ha expirado
                  </h1>
                  <p className="mt-2 max-w-md text-sm text-slate-500">
                    El período de prueba gratuita de 7 días ha concluido. Elige un plan para
                    seguir usando Hisamed.
                  </p>
                  <Link
                    href="/configuracion"
                    className="mt-4 inline-block text-sm font-medium text-teal-700 hover:underline"
                  >
                    Ir a configuración para exportar tus datos →
                  </Link>
                </div>

                <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
                  {PLANS.map((plan) => (
                    <div
                      key={plan.key}
                      className={[
                        'glass-card flex flex-col rounded-2xl p-6',
                        plan.highlight
                          ? 'ring-2 ring-teal-500'
                          : 'ring-1 ring-slate-900/8',
                      ].join(' ')}
                    >
                      {plan.highlight && (
                        <span className="mb-3 self-start rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-700">
                          Popular
                        </span>
                      )}
                      <p className="text-base font-semibold text-slate-900">{plan.name}</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{plan.price}</p>
                      <ul className="mt-4 flex-1 space-y-2">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-[13px] text-slate-600">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        disabled
                        className="mt-6 w-full cursor-not-allowed rounded-xl bg-teal-600/40 py-2.5 text-[13px] font-semibold text-white"
                      >
                        Suscribirse
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              children
            )}
          </ToastProvider>
        </main>
      </div>
    </div>
  );
}
