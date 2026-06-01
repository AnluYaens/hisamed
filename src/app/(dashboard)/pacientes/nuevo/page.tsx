import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createPatient } from '@/actions/patients';
import { PatientForm } from '@/components/patients/patient-form';
import { getClinicSettings } from '@/queries/clinic';
import { todayInTz } from '@/lib/dates';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { patientsRootCrumb } from '@/lib/breadcrumbs';

export default async function NuevoPacientePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { timezone } = await getClinicSettings(session.clinicId);
  const todayStr = todayInTz(timezone);

  return (
    <div className="mx-auto max-w-2xl p-6 lg:p-8">
      <Breadcrumbs
        items={[patientsRootCrumb(), { label: 'Nuevo paciente' }]}
      />

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Registrar nuevo paciente
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Los campos marcados con <span className="text-red-500">*</span> son obligatorios.
        </p>

        <PatientForm
          action={createPatient}
          mode="create"
          todayStr={todayStr}
          clinicId={session.clinicId}
        />
      </div>
    </div>
  );
}
