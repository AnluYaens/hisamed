import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createPatient } from '@/actions/patients';
import { PatientForm } from '@/components/patients/patient-form';

export default async function NuevoPacientePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="mx-auto max-w-2xl p-6 lg:p-8">
      {/* Back link */}
      <Link
        href="/pacientes"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a pacientes
      </Link>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Registrar nuevo paciente
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Los campos marcados con <span className="text-red-500">*</span> son obligatorios.
        </p>

        <PatientForm action={createPatient} mode="create" />
      </div>
    </div>
  );
}
