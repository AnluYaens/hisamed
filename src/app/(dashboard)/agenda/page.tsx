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
  // es-VE renders dates fully lowercase ("miércoles, 10 de junio de 2026").
  // Capitalize only the first letter — a CSS `capitalize` would wrongly
  // uppercase every word ("Miércoles, 10 De Junio De 2026").
  const label = date.toLocaleDateString('es-VE', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
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
    <div className="fade-in p-4 sm:p-8 lg:px-10">
      {/* Page header */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900 sm:text-[28px] md:text-[32px]">
            Agenda
          </h1>
          <p className="mt-1 text-sm text-slate-500">{title}</p>
        </div>
        <AppointmentFormDrawer
          doctors={doctors}
          todayStr={todayStr}
          defaultDate={activeDateStr}
          defaultDoctorId={selectedDoctorId}
        />
      </div>

      {/* Controls */}
      <div className="mb-5">
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
          isToday={activeDateStr === todayStr}
        />
      )}
    </div>
  );
}
