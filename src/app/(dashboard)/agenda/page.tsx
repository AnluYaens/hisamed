import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getAppointmentsByDate, getAppointmentsByWeek, getDoctorsForClinic } from '@/queries/appointments';
import { getClinicSettings } from '@/queries/clinic';
import { DailyView } from '@/components/appointments/daily-view';
import { WeeklyView } from '@/components/appointments/weekly-view';
import { AgendaControls } from '@/components/appointments/agenda-client';
import { AppointmentFormDrawer } from '@/components/appointments/appointment-form';
import { toDateStr, parseDateStr, todayInTz, getWeekStart } from '@/lib/dates';

type ViewMode = 'day' | 'week';

interface PageProps {
  searchParams: Promise<{
    view?: string;
    date?: string;
    doctor?: string;
  }>;
}

// Parse a YYYY-MM-DD string, falling back to a clinic-tz "today" string if
// parsing fails. We deliberately do NOT fall back to `new Date()` because
// that would use the server's local timezone, violating our rule of always
// deriving "today" from the clinic's timezone (see lib/dates.ts header).
function parseDate(str: string | undefined, fallbackTodayStr: string): Date {
  return parseDateStr(str) ?? parseDateStr(fallbackTodayStr) ?? new Date();
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${weekStart.toLocaleDateString('es-VE', opts)} – ${weekEnd.toLocaleDateString('es-VE', { ...opts, year: 'numeric' })}`;
}

function formatDayTitle(date: Date): string {
  return date.toLocaleDateString('es-VE', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function AgendaPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const view: ViewMode = params.view === 'week' ? 'week' : 'day';
  const selectedDoctorId = params.doctor ?? undefined;

  const { timezone: clinicTimezone, weekStartsOn } = await getClinicSettings(session.clinicId);
  const todayStr = todayInTz(clinicTimezone);

  // When the URL has no date — or contains an invalid one — fall back to
  // "today" in the clinic's timezone (not the server's). Otherwise dates
  // near midnight could end up on the wrong day depending on where the
  // server is hosted.
  const rawDate = parseDate(params.date, todayStr);
  const activeDate = view === 'week' ? getWeekStart(rawDate, weekStartsOn) : rawDate;
  const activeDateStr = toDateStr(activeDate);

  const [doctors, appointments] = await Promise.all([
    getDoctorsForClinic(session.clinicId),
    view === 'week'
      ? getAppointmentsByWeek(session.clinicId, activeDate, selectedDoctorId)
      : getAppointmentsByDate(session.clinicId, activeDate, selectedDoctorId),
  ]);

  const showDoctor = !selectedDoctorId && doctors.length > 1;

  const title = view === 'week'
    ? formatWeekRange(activeDate)
    : formatDayTitle(activeDate);

  return (
    <div className="p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold capitalize tracking-tight text-zinc-900 dark:text-zinc-100">
            Agenda
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{title}</p>
        </div>
        <AppointmentFormDrawer
          doctors={doctors}
          todayStr={todayStr}
          defaultDate={activeDateStr}
          defaultDoctorId={selectedDoctorId}
        />
      </div>

      {/* Controls */}
      <div className="mb-4">
        <AgendaControls
          doctors={doctors}
          weekStartsOn={weekStartsOn}
          todayStr={todayStr}
        />
      </div>

      {/* Calendar content */}
      {view === 'week' ? (
        <WeeklyView
          appointments={appointments}
          weekStart={activeDate}
          todayStr={todayStr}
          weekStartsOn={weekStartsOn}
          showDoctor={showDoctor}
        />
      ) : (
        <DailyView
          appointments={appointments}
          date={activeDate}
          showDoctor={showDoctor}
        />
      )}
    </div>
  );
}
