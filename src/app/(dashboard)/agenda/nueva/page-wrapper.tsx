import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorsForClinic } from '@/queries/appointments';
import { getClinicSettings } from '@/queries/clinic';
import { todayInTz } from '@/lib/dates';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { NewAppointmentForm } from './new-appointment-form';

export async function NewAppointmentPageWrapper() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [doctors, { timezone }] = await Promise.all([
    getDoctorsForClinic(session.clinicId),
    getClinicSettings(session.clinicId),
  ]);
  const todayStr = todayInTz(timezone);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Breadcrumbs
        items={[
          { label: 'Agenda', href: '/agenda' },
          { label: 'Nueva cita' },
        ]}
      />

      <div className="mx-auto max-w-lg">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Nueva cita
        </h1>
        <NewAppointmentForm doctors={doctors} todayStr={todayStr} />
      </div>
    </div>
  );
}
