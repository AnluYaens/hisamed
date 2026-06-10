import Link from 'next/link';
import { Suspense } from 'react';
import { UserPlus } from 'lucide-react';

import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getPatients } from '@/queries/patients';
import { getClinicSettings } from '@/queries/clinic';
import { todayInTz } from '@/lib/dates';
import { PatientSearchBar } from '@/components/patients/patient-search-bar';
import { PatientList } from '@/components/patients/patient-list';
import { buttonVariants } from '@/components/ui/button';

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function PacientesPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const search = params.q ?? '';
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);

  const [data, clinicSettings] = await Promise.all([
    getPatients(session.clinicId, { search, page, includeObstetric: session.role !== 'receptionist' }),
    getClinicSettings(session.clinicId),
  ]);
  const todayStr = todayInTz(clinicSettings.timezone);

  return (
    <div className="fade-in p-4 sm:p-8 lg:px-10">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900 sm:text-[28px] md:text-[32px]">
            Pacientes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.total} paciente{data.total !== 1 ? 's' : ''} registrado
            {data.total !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/pacientes/nuevo" className={buttonVariants()}>
          <UserPlus className="h-4 w-4" />
          Nuevo paciente
        </Link>
      </div>

      {/* Search bar */}
      <div className="mb-5">
        <Suspense>
          <PatientSearchBar />
        </Suspense>
      </div>

      {/* List */}
      <Suspense
        fallback={
          <div className="h-64 animate-pulse rounded-[20px] bg-white/40" />
        }
      >
        <PatientList data={data} todayStr={todayStr} canCreate />
      </Suspense>
    </div>
  );
}
