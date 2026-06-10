import { Calendar } from 'lucide-react';
import { AppointmentCard } from '@/components/appointments/appointment-card';
import { STATUS_CONFIG } from '@/components/appointments/status-badge';
import type { AppointmentWithDetails } from '@/queries/appointments';
import type { AppointmentStatus } from '@/lib/validators/appointment';

interface DailyViewProps {
  appointments: AppointmentWithDetails[];
  date: Date;
  showDoctor?: boolean;
  /** True when `date` is the clinic-timezone "today" — drives the empty copy. */
  isToday?: boolean;
}

// Soft timeline-dot color per appointment status.
const DOT_COLOR: Record<AppointmentStatus, string> = {
  scheduled: 'bg-zinc-300',
  confirmed: 'bg-blue-400',
  waiting: 'bg-amber-400',
  in_progress: 'bg-orange-400',
  completed: 'bg-teal-500',
  cancelled: 'bg-red-300',
  no_show: 'bg-red-400',
};

function formatDateHeader(date: Date): string {
  // es-VE renders dates fully lowercase; capitalize only the first letter.
  // (A CSS `capitalize` would wrongly uppercase "De Junio De".)
  const label = date.toLocaleDateString('es-VE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function DailyView({
  appointments,
  date,
  showDoctor = false,
  isToday = false,
}: DailyViewProps) {
  if (appointments.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center rounded-[22px] py-14 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#F0FDFA,#CCFBF1)] text-teal-600 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.15),0_8px_18px_-8px_rgba(13,148,136,0.35)]">
          <Calendar className="h-7 w-7" />
        </span>
        <p className="mt-2 text-[15px] font-semibold text-slate-800">
          {isToday
            ? 'No tienes citas programadas para hoy'
            : 'Sin citas para este día'}
        </p>
        <p className="mt-1 max-w-80 text-[13px] leading-relaxed text-slate-500">
          {isToday
            ? 'Las próximas citas aparecerán aquí cuando sean registradas.'
            : formatDateHeader(date)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] font-medium text-slate-500">
        {formatDateHeader(date)} · {appointments.length} cita
        {appointments.length !== 1 ? 's' : ''}
      </p>
      {/* Vertical timeline */}
      <ol className="relative ml-1.5 space-y-3 border-l-2 border-slate-900/8 pl-6">
        {appointments.map((appt) => (
          <li key={appt.id} className="relative">
            <span
              aria-hidden
              className={`absolute -left-[1.95rem] top-4 h-3.5 w-3.5 rounded-full border-2 border-white ring-1 ring-slate-900/10 ${
                DOT_COLOR[appt.status] ?? DOT_COLOR.scheduled
              }`}
              title={STATUS_CONFIG[appt.status]?.label}
            />
            <AppointmentCard appointment={appt} showDoctor={showDoctor} />
          </li>
        ))}
      </ol>
    </div>
  );
}
