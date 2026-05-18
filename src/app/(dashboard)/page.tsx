import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { CalendarDays, ChevronRight, FileText, Hourglass, Users } from 'lucide-react';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { getClinicSettings } from '@/queries/clinic';
import { getDashboardStats } from '@/queries/dashboard';
import { getAppointmentsByDate } from '@/queries/appointments';
import { todayInTz, parseDateStr } from '@/lib/dates';
import { TodayQueue } from '@/components/appointments/today-queue';
import { StatusBadge } from '@/components/appointments/status-badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

/** Time-of-day greeting derived from the clinic's timezone (never the server's). */
function getGreeting(timezone: string): string {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: timezone,
  }).format(new Date());
  const hour = parseInt(hourStr, 10) % 24;
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [{ timezone }, user] = await Promise.all([
    getClinicSettings(session.clinicId),
    db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: { fullName: true },
    }),
  ]);
  const today = todayInTz(timezone);
  const todayDate = parseDateStr(today)!;
  const isDoctor = session.role === 'doctor';

  const [stats, todayAppointments] = await Promise.all([
    getDashboardStats(session.clinicId, timezone),
    getAppointmentsByDate(
      session.clinicId,
      todayDate,
      isDoctor ? session.userId : undefined,
    ),
  ]);

  const nextAppointment = isDoctor
    ? todayAppointments.find(
        (a) => a.status !== 'completed' && a.status !== 'cancelled' && a.status !== 'no_show',
      )
    : null;

  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const displayName = isDoctor ? `Dr. ${firstName}` : firstName;

  // Each stat card carries a faint full-bleed color wash (--card-tint) and a
  // solid-gradient icon tile, so the dashboard reads at a glance.
  const statCards = [
    {
      label: 'Pacientes activos',
      value: stats.activePatients,
      icon: Users,
      tile: 'linear-gradient(135deg, #5EEAD4, #14B8A6)',
      tint: 'linear-gradient(135deg, rgba(94,234,212,0.18), transparent 60%)',
    },
    {
      label: 'Citas hoy',
      value: stats.todayTotal,
      icon: CalendarDays,
      tile: 'linear-gradient(135deg, #93C5FD, #3B82F6)',
      tint: 'linear-gradient(135deg, rgba(147,197,253,0.20), transparent 60%)',
    },
    {
      label: 'En espera',
      value: stats.todayByStatus.waiting ?? 0,
      icon: Hourglass,
      tile: 'linear-gradient(135deg, #FDE68A, #F59E0B)',
      tint: 'linear-gradient(135deg, rgba(253,230,138,0.25), transparent 60%)',
    },
    {
      label: 'Consultas del mes',
      value: stats.monthlyConsultations,
      icon: FileText,
      tile: 'linear-gradient(135deg, #C4B5FD, #8B5CF6)',
      tint: 'linear-gradient(135deg, rgba(196,181,253,0.20), transparent 60%)',
    },
  ];

  const dateLabel = new Intl.DateTimeFormat('es-VE', {
    dateStyle: 'full',
    timeZone: timezone,
  }).format(new Date());

  return (
    <div className="fade-in p-6 sm:p-8 lg:px-10">
      {/* Branded greeting header — the only solid-color card in the app. */}
      <div className="greeting-card mb-6 rounded-[22px] px-8 py-7 sm:px-9">
        <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.025em] text-white">
          {getGreeting(timezone)}
          {displayName ? `, ${displayName}` : ''}
        </h1>
        <p className="mt-1.5 text-sm capitalize text-teal-50/85">{dateLabel}</p>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid gap-4.5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, tile, tint }) => (
          <div
            key={label}
            className="stat-card p-5.5"
            style={{ '--card-tint': tint } as React.CSSProperties}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-[38px] font-bold leading-none tabular-nums tracking-[-0.03em] text-slate-900">
                  {value}
                </p>
              </div>
              <div
                className="glass-tile flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: tile }}
              >
                <Icon className="h-[22px] w-[22px] text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom section */}
      <div className={isDoctor ? 'grid gap-6 lg:grid-cols-3' : 'grid gap-6'}>
        {/* Left column — next patient + pending tasks (doctors only) */}
        {isDoctor && (
          <div className="flex flex-col gap-6 lg:col-span-1">
            <div>
              <h2 className="mb-3.5 text-[13px] font-semibold text-slate-700">
                Próximo paciente
              </h2>
              {nextAppointment ? (
                <div className="next-card rounded-[22px] p-5.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#0D9488,#0F766E)] text-base font-semibold text-white shadow-[0_8px_18px_-6px_rgba(13,148,136,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]">
                      {nextAppointment.patient.firstName[0]}
                      {nextAppointment.patient.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold tracking-[-0.01em] text-slate-900">
                        {nextAppointment.patient.firstName}{' '}
                        {nextAppointment.patient.lastName}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-sm text-slate-600">
                          {formatTime(nextAppointment.startTime)}
                        </span>
                        <StatusBadge status={nextAppointment.status} />
                      </div>
                    </div>
                  </div>
                  {nextAppointment.reason && (
                    <p className="mt-3.5 line-clamp-2 text-[13px] text-slate-700">
                      {nextAppointment.reason}
                    </p>
                  )}
                  <Link
                    href={`/pacientes/${nextAppointment.patientId}`}
                    className={cn(
                      buttonVariants({ size: 'lg' }),
                      'mt-4.5 w-full',
                    )}
                  >
                    Atender paciente
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <div className="glass-card flex flex-col items-center justify-center rounded-[22px] py-14 text-center">
                  <span className="mb-2 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#F0FDFA,#CCFBF1)] text-teal-600 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.15),0_8px_18px_-8px_rgba(13,148,136,0.35)]">
                    <Users className="h-7 w-7" />
                  </span>
                  <p className="mt-2 text-[15px] font-semibold text-slate-800">
                    Sin pacientes pendientes
                  </p>
                  <p className="mt-1 max-w-70 text-[13px] leading-relaxed text-slate-500">
                    Las citas activas del día aparecerán aquí.
                  </p>
                </div>
              )}
            </div>

            {/* Pendientes — clinical follow-ups (unsigned notes, pending labs,
                prescriptions to deliver). TODO: no dedicated queries exist yet;
                wire real counts here once they land. Empty state for now. */}
            <div>
              <h2 className="mb-3.5 text-[13px] font-semibold text-slate-700">
                Pendientes
              </h2>
              <div className="glass-card flex flex-col items-center justify-center rounded-[22px] py-12 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#F0FDFA,#CCFBF1)] text-teal-600 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.15),0_8px_18px_-8px_rgba(13,148,136,0.35)]">
                  <FileText className="h-7 w-7" />
                </span>
                <p className="mt-2 text-[15px] font-semibold text-slate-800">
                  Sin pendientes
                </p>
                <p className="mt-1 max-w-70 text-[13px] leading-relaxed text-slate-500">
                  Las notas por firmar y tareas del día aparecerán aquí.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Today's queue */}
        <div className={isDoctor ? 'lg:col-span-2' : ''}>
          <h2 className="mb-3.5 text-[13px] font-semibold text-slate-700">
            {isDoctor ? 'Mis citas de hoy' : 'Pacientes del día'}
          </h2>
          <TodayQueue appointments={todayAppointments} showDoctor={!isDoctor} />
        </div>
      </div>
    </div>
  );
}
