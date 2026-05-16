import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import {
  Activity,
  BarChart3,
  FileText,
  Paperclip,
  Baby,
  AlertTriangle,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getClinicSettings } from '@/queries/clinic';
import { canAccessReports, canFilterByDoctor } from '@/lib/reports/access';
import { resolveDateRange } from '@/lib/reports/date-range';
import { todayInTz } from '@/lib/dates';
import {
  getClinicReport,
  getClinicDoctorsForFilter,
  APPOINTMENT_STATUSES,
  DOCUMENT_TYPES,
  ATTACHMENT_CATEGORIES,
} from '@/queries/reports';
import { ReportFilters } from '@/components/reports/report-filters';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function str(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : '';
}

// ─── Spanish labels ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada',
  confirmed: 'Confirmada',
  waiting: 'En espera',
  in_progress: 'En consulta',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  medical_rest: 'Reposo médico',
  medical_certificate: 'Constancia',
  referral: 'Referencia',
  prescription: 'Récipe',
  patient_instructions: 'Indicaciones',
  lab_order: 'Orden de laboratorio',
  imaging_order: 'Orden de imagen',
  interconsultation: 'Interconsulta',
};

const CATEGORY_LABELS: Record<string, string> = {
  lab_result: 'Resultado de laboratorio',
  imaging: 'Imagenología',
  consent: 'Consentimiento',
  prescription: 'Récipe',
  procedure_photo: 'Foto de procedimiento',
  ultrasound: 'Ecografía',
  other: 'Otro',
};

const ACTION_LABELS: Record<string, string> = {
  EXPORT: 'Exportación PDF',
  EMAIL_EXPORT: 'Envío por correo',
};

const EXPORT_STATUS_LABELS: Record<string, string> = {
  attempted: 'Intentado',
  sent: 'Enviado',
  failed: 'Fallido',
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  note: 'Nota clínica',
  document: 'Documento',
  attachment: 'Adjunto',
};

function formatDateTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

// ─── Presentational helpers ───────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {value.toLocaleString('es-VE')}
      </p>
      <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: typeof Activity;
  title: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
        <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </div>
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
    </div>
  );
}

function BarList({
  rows,
  color = 'bg-blue-500',
}: {
  rows: { label: string; value: number }[];
  color?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-44 shrink-0 truncate text-xs text-zinc-600 dark:text-zinc-400">
              {r.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full ${color}`}
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {r.value.toLocaleString('es-VE')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportesPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!canAccessReports(session.role)) notFound();

  const isAdmin = canFilterByDoctor(session.role);

  const params = await searchParams;
  const settings = await getClinicSettings(session.clinicId);
  const timezone = settings.timezone;
  const today = todayInTz(timezone);

  const range = resolveDateRange(
    str(params.preset),
    today,
    str(params.from),
    str(params.to),
  );

  // The doctor filter is admin-only; a doctor's own session never narrows
  // the dashboard, and the param is ignored for non-admins.
  const doctorId = isAdmin ? str(params.doctorId) : '';

  const [doctors, report] = await Promise.all([
    isAdmin
      ? getClinicDoctorsForFilter(session.clinicId)
      : Promise.resolve([] as { id: string; fullName: string }[]),
    getClinicReport(session.clinicId, timezone, {
      from: range.from,
      to: range.to,
      today,
      doctorId: doctorId || null,
    }),
  ]);

  const { activity, documents, attachments, obstetric, recentExports, recentActivity } =
    report;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Reportes
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {range.from} — {range.to}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <Suspense>
          <ReportFilters
            preset={range.preset}
            from={range.from}
            to={range.to}
            doctorId={doctorId}
            doctors={doctors}
            canFilterByDoctor={isAdmin}
          />
        </Suspense>
      </div>

      {range.error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {range.error}
        </div>
      )}

      {!report.hasData ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <BarChart3 className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            No hay datos para este período.
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Ajusta el rango de fechas para ver más resultados.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* A — Actividad clínica */}
          <section>
            <SectionHeader icon={Activity} title="Actividad clínica" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <StatCard label="Pacientes totales" value={activity.totalPatients} />
              <StatCard label="Pacientes nuevos" value={activity.newPatients} />
              <StatCard label="Citas en el período" value={activity.totalAppointments} />
              <StatCard
                label="Citas completadas"
                value={activity.appointmentsByStatus.completed}
              />
              <StatCard
                label="Citas canceladas"
                value={activity.appointmentsByStatus.cancelled}
              />
              <StatCard
                label="Inasistencias"
                value={activity.appointmentsByStatus.no_show}
              />
              <StatCard label="Notas clínicas" value={activity.notesCreated} />
              <StatCard label="Notas firmadas" value={activity.notesSigned} />
              <StatCard label="Borradores" value={activity.notesDraft} />
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Distribución de citas por estado
                </p>
                <BarList
                  rows={APPOINTMENT_STATUSES.map((s) => ({
                    label: STATUS_LABELS[s] ?? s,
                    value: activity.appointmentsByStatus[s],
                  }))}
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Notas firmadas vs. borradores
                </p>
                <BarList
                  color="bg-emerald-500"
                  rows={[
                    { label: 'Firmadas', value: activity.notesSigned },
                    { label: 'Borradores', value: activity.notesDraft },
                  ]}
                />
              </div>
            </div>
          </section>

          {/* B — Documentos */}
          <section>
            <SectionHeader icon={FileText} title="Documentos" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Documentos generados" value={documents.totalDocuments} />
              <StatCard label="Exportaciones PDF" value={documents.historyPdfExports} />
              <StatCard
                label="Correos enviados"
                value={documents.historyEmailExportsSent}
              />
              <StatCard
                label="Correos intentados"
                value={documents.historyEmailExportsAttempted}
              />
            </div>
            <div className="mt-3">
              <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Documentos por tipo
              </p>
              <BarList
                color="bg-violet-500"
                rows={DOCUMENT_TYPES.map((t) => ({
                  label: DOC_TYPE_LABELS[t] ?? t,
                  value: documents.byType[t],
                }))}
              />
            </div>
          </section>

          {/* C — Adjuntos */}
          <section>
            <SectionHeader icon={Paperclip} title="Adjuntos" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Adjuntos cargados" value={attachments.totalAttachments} />
              <StatCard label="Ecografías" value={attachments.ultrasoundCount} />
              <StatCard
                label="Fotos de procedimiento"
                value={attachments.procedurePhotoCount}
              />
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                <p className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {attachments.totalStorageMb.toLocaleString('es-VE')}
                </p>
                <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Almacenamiento (MB)
                </p>
              </div>
            </div>
            <div className="mt-3">
              <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Adjuntos por categoría
              </p>
              <BarList
                color="bg-amber-500"
                rows={ATTACHMENT_CATEGORIES.map((c) => ({
                  label: CATEGORY_LABELS[c] ?? c,
                  value: attachments.byCategory[c],
                }))}
              />
            </div>
          </section>

          {/* D — Obstetricia y ginecología */}
          <section>
            <SectionHeader icon={Baby} title="Obstetricia y ginecología" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Embarazos activos" value={obstetric.activePregnancies} />
              <StatCard
                label="Alertas de FUM vencida"
                value={obstetric.staleFumWarnings}
              />
              <StatCard label="Notas con ecografía" value={obstetric.ultrasoundNotes} />
              <StatCard
                label="Notas con examen ginecológico"
                value={obstetric.gynecologicalExamNotes}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              Embarazos activos y alertas de FUM reflejan el estado actual, no el
              período seleccionado.
            </p>
          </section>

          {/* E — Actividad reciente */}
          <section>
            <SectionHeader icon={BarChart3} title="Actividad reciente" />
            <div className="grid gap-3 lg:grid-cols-2">
              {/* Recent exports */}
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                <div className="border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Exportaciones y envíos
                  </p>
                </div>
                {recentExports.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                    No hay datos para este período.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                      {recentExports.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                            {formatDateTime(row.createdAt, timezone)}
                          </td>
                          <td className="px-4 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                            {row.userFullName ?? (
                              <span className="italic text-zinc-400">
                                Usuario eliminado
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                            {ACTION_LABELS[row.action] ?? row.action}
                          </td>
                          <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                            {row.status
                              ? (EXPORT_STATUS_LABELS[row.status] ?? row.status)
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Recent clinical activity */}
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                <div className="border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Actividad clínica reciente
                  </p>
                </div>
                {recentActivity.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                    No hay datos para este período.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                      {recentActivity.map((row) => (
                        <tr key={`${row.type}-${row.id}`}>
                          <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                            {formatDateTime(row.occurredAt, timezone)}
                          </td>
                          <td className="px-4 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                            {row.patientName}
                          </td>
                          <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                            {row.doctorName}
                          </td>
                          <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                            {ACTIVITY_TYPE_LABELS[row.type]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
