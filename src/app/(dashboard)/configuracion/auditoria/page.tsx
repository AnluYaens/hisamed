import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getClinicSettings } from '@/queries/clinic';
import { getAuditLogs, getClinicUsersForFilter } from '@/queries/audit-logs';
import { AuditLogFilters } from '@/components/audit/audit-log-filters';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Creación',
  READ: 'Lectura',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  EXPORT: 'Exportación',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/30 dark:text-green-400',
  READ: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400',
  UPDATE:
    'bg-yellow-50 text-yellow-700 ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400',
  DELETE: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/30 dark:text-red-400',
  LOGIN: 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-900/30 dark:text-purple-400',
  LOGOUT: 'bg-zinc-50 text-zinc-700 ring-zinc-600/20 dark:bg-zinc-800 dark:text-zinc-400',
  EXPORT:
    'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-900/30 dark:text-orange-400',
};

const RESOURCE_LABELS: Record<string, string> = {
  patient: 'Paciente',
  medical_history: 'Historia clínica',
  appointment: 'Cita',
  clinical_note: 'Nota clínica',
  attachment: 'Adjunto',
  user: 'Usuario',
  session: 'Sesión',
};

function str(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : '';
}

function buildUrl(
  base: string,
  params: Record<string, string | undefined>,
  page: number,
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v);
  }
  if (page > 1) p.set('page', String(page));
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

function formatDateTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export default async function AuditoriaPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') notFound();

  const params = await searchParams;
  const filters = {
    dateFrom: str(params.dateFrom),
    dateTo: str(params.dateTo),
    userId: str(params.userId),
    action: str(params.action),
    resourceType: str(params.resourceType),
  };
  const page = Math.max(1, parseInt(str(params.page) || '1', 10) || 1);

  const clinicSettings = await getClinicSettings(session.clinicId);
  const [clinicUsers, data] = await Promise.all([
    getClinicUsersForFilter(session.clinicId),
    getAuditLogs(session.clinicId, clinicSettings.timezone, filters, page),
  ]);

  // Use clinic timezone for date display
  const timezone = clinicSettings.timezone;

  const base = '/configuracion/auditoria';
  const filterParams = {
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    userId: filters.userId || undefined,
    action: filters.action || undefined,
    resourceType: filters.resourceType || undefined,
  };

  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/configuracion"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Configuración
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Log de auditoría
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {data.total} registro{data.total !== 1 ? 's' : ''}
            {data.total > 0 ? ` · Página ${data.page} de ${data.totalPages}` : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <Suspense>
          <AuditLogFilters clinicUsers={clinicUsers} currentFilters={filters} />
        </Suspense>
      </div>

      {/* Table */}
      {data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <Shield className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            No se encontraron registros
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Intenta ajustar los filtros
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Fecha / Hora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Acción
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Recurso
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Detalles
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                {data.items.map((log) => (
                  <tr
                    key={log.id}
                    className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {formatDateTime(log.createdAt, timezone)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {log.userFullName ?? (
                          <span className="italic text-zinc-400 dark:text-zinc-500">
                            Usuario eliminado
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ACTION_COLORS[log.action] ?? 'bg-zinc-50 text-zinc-700 ring-zinc-600/20'}`}
                      >
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {RESOURCE_LABELS[log.resourceType] ?? log.resourceType}
                        </span>
                        {log.resourceId && (
                          <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
                            {log.resourceId.slice(0, 8)}…
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      {log.details ? (
                        <pre className="max-h-16 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 dark:border-zinc-700">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Mostrando {(data.page - 1) * data.limit + 1}–
                {Math.min(data.page * data.limit, data.total)} de {data.total}
              </p>
              <div className="flex items-center gap-1">
                {data.page > 1 ? (
                  <Link
                    href={buildUrl(base, filterParams, data.page - 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-md border border-zinc-100 bg-white text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="px-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {data.page} / {data.totalPages}
                </span>
                {data.page < data.totalPages ? (
                  <Link
                    href={buildUrl(base, filterParams, data.page + 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-md border border-zinc-100 bg-white text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
