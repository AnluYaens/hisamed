import Link from 'next/link';
import { Calendar, Clock, User } from 'lucide-react';
import { StatusBadge } from '@/components/appointments/status-badge';
import type { AppointmentWithDetails } from '@/queries/appointments';
import type { AppointmentStatus } from '@/lib/validators/appointment';

interface PatientAppointmentsProps {
  appointments: AppointmentWithDetails[];
  patientId: string;
  /** YYYY-MM-DD of "today" in the clinic's timezone. */
  todayStr: string;
}

// Terminal statuses: the appointment will not happen (or already happened).
// These always belong to "Historial" regardless of whether the calendar
// date is past, today, or future. Without `completed` here, an appointment
// finished earlier today would still show up under "Próximas".
const FINAL_STATUSES = new Set<AppointmentStatus>(['completed', 'cancelled', 'no_show']);

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function PatientAppointments({ appointments, patientId, todayStr }: PatientAppointmentsProps) {
  const upcoming = appointments.filter((a) => a.date >= todayStr && !FINAL_STATUSES.has(a.status));
  const past = appointments.filter((a) => a.date < todayStr || FINAL_STATUSES.has(a.status));

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <Calendar className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-600" />
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Sin citas registradas</p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Las citas del paciente aparecerán aquí.
        </p>
        <Link
          href="/agenda/nueva"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Calendar className="h-3.5 w-3.5" />
          Nueva cita
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with link to agenda */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {appointments.length} cita{appointments.length !== 1 ? 's' : ''} en total
        </p>
        <Link
          href="/agenda/nueva"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Calendar className="h-3.5 w-3.5" />
          Nueva cita
        </Link>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Próximas
          </h3>
          <div className="space-y-2">
            {upcoming.map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} />
            ))}
          </div>
        </section>
      )}

      {/* Past */}
      {past.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Historial
          </h3>
          <div className="space-y-2">
            {past.map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AppointmentRow({ appt }: { appt: AppointmentWithDetails }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
      {/* Date column */}
      <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-zinc-50 py-1.5 text-center dark:bg-zinc-800">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {new Date(appt.date + 'T00:00:00').toLocaleDateString('es-VE', { month: 'short' }).toUpperCase()}
        </span>
        <span className="text-lg font-bold leading-tight text-zinc-900 dark:text-zinc-100">
          {new Date(appt.date + 'T00:00:00').getDate()}
        </span>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <Clock className="h-3 w-3" />
            {formatTime(appt.startTime)}
            {appt.endTime && <> – {formatTime(appt.endTime)}</>}
          </div>
          <StatusBadge status={appt.status} />
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          <User className="h-3.5 w-3.5 shrink-0" />
          {appt.doctor.fullName}
        </div>
        {appt.reason && (
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{appt.reason}</p>
        )}
      </div>
    </div>
  );
}
