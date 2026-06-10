import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getClinicSettings } from '@/queries/clinic';
import { getAuditLogs, getClinicUsersForFilter } from '@/queries/audit-logs';
import { AuditLogFilters } from '@/components/audit/audit-log-filters';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { settingsTrail } from '@/lib/breadcrumbs';

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

// Capsule status pills — soft alpha fills, Vision style.
const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-700/14 text-green-700',
  READ: 'bg-blue-600/12 text-blue-700',
  UPDATE: 'bg-amber-600/14 text-amber-700',
  DELETE: 'bg-red-600/12 text-red-600',
  LOGIN: 'bg-violet-600/12 text-violet-700',
  LOGOUT: 'bg-zinc-500/12 text-slate-700',
  EXPORT: 'bg-orange-600/14 text-orange-700',
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
  if (session.role !== 'admin' && session.role !== 'doctor') notFound();

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
    <div className="fade-in p-4 sm:p-8 lg:px-10">
      <Breadcrumbs items={settingsTrail({ label: 'Auditoría' })} />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900 sm:text-[28px] md:text-[32px]">
          Log de auditoría
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {data.total} registro{data.total !== 1 ? 's' : ''}
          {data.total > 0 ? ` · Página ${data.page} de ${data.totalPages}` : ''}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-5">
        <Suspense>
          <AuditLogFilters clinicUsers={clinicUsers} currentFilters={filters} />
        </Suspense>
      </div>

      {/* Table */}
      {data.items.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center rounded-[22px] py-14 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#F0FDFA,#CCFBF1)] text-teal-600 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.15),0_8px_18px_-8px_rgba(13,148,136,0.35)]">
            <Shield className="h-7 w-7" />
          </span>
          <p className="mt-2 text-[15px] font-semibold text-slate-800">
            No se encontraron registros
          </p>
          <p className="mt-1 max-w-80 text-[13px] leading-relaxed text-slate-500">
            Intenta ajustar los filtros.
          </p>
        </div>
      ) : (
        <div className="glass-surface overflow-hidden rounded-[20px]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-900/6 bg-slate-50/60">
                  {['Fecha / Hora', 'Usuario', 'Acción', 'Recurso', 'Detalles'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4.5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/4">
                {data.items.map((log) => (
                  <tr
                    key={log.id}
                    className="transition-colors hover:bg-teal-600/4"
                  >
                    <td className="whitespace-nowrap px-4.5 py-3 font-mono text-xs text-slate-600">
                      {formatDateTime(log.createdAt, timezone)}
                    </td>
                    <td className="px-4.5 py-3">
                      <span className="font-semibold text-slate-900">
                        {log.userFullName ?? (
                          <span className="italic text-slate-400">
                            Usuario eliminado
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4.5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${ACTION_COLORS[log.action] ?? 'bg-zinc-500/12 text-slate-700'}`}
                      >
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-4.5 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-700">
                          {RESOURCE_LABELS[log.resourceType] ?? log.resourceType}
                        </span>
                        {log.resourceId && (
                          <span className="font-mono text-xs text-slate-400">
                            {log.resourceId.slice(0, 8)}…
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-xs px-4.5 py-3">
                      {log.details ? (
                        <pre className="max-h-16 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-slate-500">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-900/5 px-4.5 py-3">
              <p className="text-xs text-slate-500">
                Mostrando {(data.page - 1) * data.limit + 1}–
                {Math.min(data.page * data.limit, data.total)} de {data.total}
              </p>
              <div className="flex items-center gap-1">
                {data.page > 1 ? (
                  <Link
                    href={buildUrl(base, filterParams, data.page - 1)}
                    className="glass-input inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:text-slate-900"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full border border-slate-900/5 text-slate-300">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="px-2 text-xs text-slate-500">
                  {data.page} / {data.totalPages}
                </span>
                {data.page < data.totalPages ? (
                  <Link
                    href={buildUrl(base, filterParams, data.page + 1)}
                    className="glass-input inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:text-slate-900"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full border border-slate-900/5 text-slate-300">
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
