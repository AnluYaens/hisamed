'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const AUDIT_ACTIONS = [
  { value: 'CREATE', label: 'Creación' },
  { value: 'READ', label: 'Lectura' },
  { value: 'UPDATE', label: 'Actualización' },
  { value: 'DELETE', label: 'Eliminación' },
  { value: 'LOGIN', label: 'Inicio de sesión' },
  { value: 'LOGOUT', label: 'Cierre de sesión' },
  { value: 'EXPORT', label: 'Exportación' },
];

const RESOURCE_TYPES = [
  { value: 'patient', label: 'Paciente' },
  { value: 'medical_history', label: 'Historia clínica' },
  { value: 'appointment', label: 'Cita' },
  { value: 'clinical_note', label: 'Nota clínica' },
  { value: 'attachment', label: 'Adjunto' },
  { value: 'user', label: 'Usuario' },
  { value: 'session', label: 'Sesión' },
];

interface AuditLogFiltersProps {
  clinicUsers: { id: string; fullName: string }[];
  currentFilters: {
    dateFrom: string;
    dateTo: string;
    userId: string;
    action: string;
    resourceType: string;
  };
}

export function AuditLogFilters({ clinicUsers, currentFilters }: AuditLogFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  function clearFilters() {
    router.push(pathname);
  }

  const hasFilters =
    currentFilters.dateFrom ||
    currentFilters.dateTo ||
    currentFilters.userId ||
    currentFilters.action ||
    currentFilters.resourceType;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Fecha desde
          </label>
          <input
            type="date"
            value={currentFilters.dateFrom}
            onChange={(e) => setFilter('dateFrom', e.target.value)}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Fecha hasta
          </label>
          <input
            type="date"
            value={currentFilters.dateTo}
            onChange={(e) => setFilter('dateTo', e.target.value)}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Usuario</label>
          <select
            value={currentFilters.userId}
            onChange={(e) => setFilter('userId', e.target.value)}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Todos los usuarios</option>
            {clinicUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Acción</label>
          <select
            value={currentFilters.action}
            onChange={(e) => setFilter('action', e.target.value)}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Todas las acciones</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Recurso</label>
          <select
            value={currentFilters.resourceType}
            onChange={(e) => setFilter('resourceType', e.target.value)}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Todos los recursos</option>
            {RESOURCE_TYPES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasFilters && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={clearFilters}
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}
