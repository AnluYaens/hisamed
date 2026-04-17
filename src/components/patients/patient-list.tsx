'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import type { PatientListItem, PatientsPage } from '@/queries/patients';

function calcAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

const ID_TYPE_LABELS: Record<string, string> = {
  cedula: 'V-',
  passport: 'P-',
  other: '',
};

interface PatientListProps {
  data: PatientsPage;
}

export function PatientList({ data }: PatientListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`${pathname}?${params.toString()}`);
  }

  if (data.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <User className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          No se encontraron pacientes
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Intenta con otro término de búsqueda o registra un nuevo paciente
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Nombre
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Documento
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Teléfono
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Edad
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Última cita
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.items.map((patient: PatientListItem) => (
              <PatientRow key={patient.id} patient={patient} />
            ))}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {data.total} paciente{data.total !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(data.page - 1)}
              disabled={data.page <= 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-xs text-zinc-500 dark:text-zinc-400">
              {data.page} / {data.totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(data.page + 1)}
              disabled={data.page >= data.totalPages}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PatientRow({ patient }: { patient: PatientListItem }) {
  const prefix = ID_TYPE_LABELS[patient.idType] ?? '';
  const age = calcAge(patient.dateOfBirth);

  return (
    <Link
      href={`/pacientes/${patient.id}`}
      className="group flex cursor-pointer"
      prefetch={false}
    >
      <tr className="group w-full cursor-pointer transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-950/20 [&_td]:px-4 [&_td]:py-3.5">
        <td>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              {patient.firstName[0]}
              {patient.lastName[0]}
            </div>
            <div>
              <p className="font-medium text-zinc-900 group-hover:text-blue-700 dark:text-zinc-100 dark:group-hover:text-blue-400">
                {patient.lastName}, {patient.firstName}
              </p>
              {!patient.isActive && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">(Inactivo)</span>
              )}
            </div>
          </div>
        </td>
        <td className="text-zinc-600 dark:text-zinc-400">
          {prefix}
          {patient.idNumber}
        </td>
        <td className="text-zinc-600 dark:text-zinc-400">{patient.phone ?? '—'}</td>
        <td className="text-zinc-600 dark:text-zinc-400">{age} años</td>
        <td className="text-zinc-400 dark:text-zinc-500">—</td>
      </tr>
    </Link>
  );
}
