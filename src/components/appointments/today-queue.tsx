import Link from 'next/link';
import { Clock, Users } from 'lucide-react';
import { StatusBadge } from '@/components/appointments/status-badge';
import type { AppointmentWithDetails } from '@/queries/appointments';

interface TodayQueueProps {
  appointments: AppointmentWithDetails[];
  showDoctor?: boolean;
  compact?: boolean;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function TodayQueue({ appointments, showDoctor = false, compact = false }: TodayQueueProps) {
  const active = appointments.filter(
    (a) => a.status !== 'cancelled' && a.status !== 'no_show',
  );

  if (appointments.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center rounded-[22px] py-14 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#F0FDFA,#CCFBF1)] text-teal-600 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.15),0_8px_18px_-8px_rgba(13,148,136,0.35)]">
          <Users className="h-7 w-7" />
        </span>
        <p className="mt-2 text-[15px] font-semibold text-slate-800">
          Sin citas hoy
        </p>
        <p className="mt-1 max-w-70 text-[13px] leading-relaxed text-slate-500">
          Las citas programadas para hoy se mostrarán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-surface overflow-hidden rounded-[20px]">
      <div className="flex items-center justify-between border-b border-slate-900/5 px-4.5 py-3.5">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[13px] font-medium text-slate-700">
            Cola del día
          </span>
        </div>
        <span className="rounded-full bg-teal-600/12 px-2.75 py-0.5 text-[11.5px] font-semibold text-teal-700">
          {active.length} activa{active.length !== 1 ? 's' : ''}
        </span>
      </div>

      <ul className="divide-y divide-slate-900/4">
        {appointments.map((appt) => {
          const name = `${appt.patient.firstName} ${appt.patient.lastName}`;
          return (
            <li key={appt.id} className="flex items-center gap-3.5 px-4.5 py-3.5 transition-colors duration-200 hover:bg-teal-600/4">
              {/* Avatar */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#F0FDFA,#CCFBF1)] text-xs font-semibold text-teal-700 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.15)]">
                {appt.patient.firstName[0]}
                {appt.patient.lastName[0]}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-400">
                    {formatTime(appt.startTime)}
                  </span>
                  {!compact && <StatusBadge status={appt.status} />}
                </div>
                <Link
                  href={`/pacientes/${appt.patientId}`}
                  className="block truncate text-sm font-medium text-zinc-900 hover:text-teal-700 dark:text-zinc-100 dark:hover:text-teal-400"
                >
                  {name}
                </Link>
                {showDoctor && (
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {appt.doctor.fullName}
                  </p>
                )}
                {appt.reason && !compact && (
                  <p className="truncate text-xs text-zinc-400 dark:text-zinc-500">{appt.reason}</p>
                )}
              </div>

              {compact && <StatusBadge status={appt.status} />}
            </li>
          );
        })}
      </ul>

      {appointments.length > 5 && (
        <div className="border-t border-slate-900/5 px-4.5 py-2.5">
          <Link
            href="/agenda"
            className="text-xs font-semibold text-teal-700 hover:underline"
          >
            Ver todas las citas →
          </Link>
        </div>
      )}
    </div>
  );
}
