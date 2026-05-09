'use client';

import { useMemo, useState } from 'react';
import { Activity, ChevronDown, ChevronRight } from 'lucide-react';
import type { VitalSignsRow } from '@/queries/vital-signs';
import { AttachVitalSignsButton } from './attach-vital-signs-button';

// ─── Mini SVG line chart ──────────────────────────────────────────────────────
// Recharts isn't installed in this project. Rather than pull in ~80kb of
// dependencies for three sparkline-style charts, we render a small inline SVG.
// It's deliberately minimal — axis line, dots, hover tooltip via <title>.

interface Series {
  label: string;
  values: { x: Date; y: number }[];
  color: string;
  unit: string;
}

function MiniLineChart({
  series,
  height = 140,
  yPadding = 0.1,
}: {
  series: Series[];
  height?: number;
  yPadding?: number;
}) {
  // Domain spans every series so multiple lines (e.g. systolic + diastolic)
  // share the same Y axis. Bail out if there isn't enough data to draw a line.
  const flatY = series.flatMap((s) => s.values.map((v) => v.y));
  const flatX = series.flatMap((s) => s.values.map((v) => v.x.getTime()));
  if (flatY.length === 0 || flatX.length === 0) return null;

  const yMin = Math.min(...flatY);
  const yMax = Math.max(...flatY);
  const yRange = yMax - yMin || 1;
  const yLo = yMin - yRange * yPadding;
  const yHi = yMax + yRange * yPadding;

  const xMin = Math.min(...flatX);
  const xMax = Math.max(...flatX);
  const xRange = xMax - xMin || 1;

  const width = 600;
  const padX = 36;
  const padY = 12;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const xToPx = (t: number) =>
    padX + (xRange === 0 ? innerW / 2 : ((t - xMin) / xRange) * innerW);
  const yToPx = (y: number) => padY + innerH - ((y - yLo) / (yHi - yLo)) * innerH;

  // Three reference labels on the Y axis (min/mid/max) — readers want a
  // ballpark sense of magnitude, not gridline accuracy.
  const yTicks = [yLo, (yLo + yHi) / 2, yHi];

  return (
    <svg
      role="img"
      aria-label={series.map((s) => s.label).join(', ')}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
    >
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={padX}
            x2={width - padX}
            y1={yToPx(t)}
            y2={yToPx(t)}
            className="stroke-zinc-200 dark:stroke-zinc-700"
            strokeDasharray="2 4"
          />
          <text
            x={padX - 6}
            y={yToPx(t)}
            dy="0.32em"
            textAnchor="end"
            className="fill-zinc-400 text-[10px] dark:fill-zinc-500"
          >
            {Math.round(t * 10) / 10}
          </text>
        </g>
      ))}
      {series.map((s) => {
        if (s.values.length === 0) return null;
        const points = s.values
          .map((v) => `${xToPx(v.x.getTime())},${yToPx(v.y)}`)
          .join(' ');
        return (
          <g key={s.label}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points}
            />
            {s.values.map((v, i) => (
              <circle
                key={i}
                cx={xToPx(v.x.getTime())}
                cy={yToPx(v.y)}
                r={3}
                fill={s.color}
              >
                <title>{`${s.label}: ${v.y}${s.unit} · ${v.x.toLocaleDateString()}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-3 rounded"
            style={{ backgroundColor: it.color }}
          />
          {it.label}
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface VitalSignsHistoryProps {
  records: VitalSignsRow[];
  /** IANA timezone for rendering recordedAt in the clinic's local time. */
  timeZone: string;
  /**
   * When defined, an "Asociar a esta nota" button is rendered next to every
   * record whose `clinicalNoteId` is null. Pass:
   *   - a note uuid → enabled (clicking calls attachVitalSignsToNote)
   *   - `null`      → visible but disabled (e.g. on /notas/nueva before save)
   *   - omit        → no button (default for read-only contexts like the
   *                   patient detail "Signos vitales" tab)
   */
  attachToNoteId?: string | null;
}

export function VitalSignsHistory({
  records,
  timeZone,
  attachToNoteId,
}: VitalSignsHistoryProps) {
  const showAttachButton = attachToNoteId !== undefined;
  const [showAll, setShowAll] = useState(false);

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat('es-VE', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone,
      }),
    [timeZone],
  );

  // Charts read oldest-first so the line moves left → right.
  const chronological = useMemo(
    () => [...records].slice().reverse(),
    [records],
  );

  const weightSeries = useMemo<Series[]>(() => {
    const values = chronological
      .filter((r) => r.weightKg != null)
      .map((r) => ({ x: r.recordedAt, y: r.weightKg as number }));
    return values.length >= 2
      ? [{ label: 'Peso', values, color: '#2563eb', unit: ' kg' }]
      : [];
  }, [chronological]);

  const bpSeries = useMemo<Series[]>(() => {
    const sys = chronological
      .filter((r) => r.systolicBp != null)
      .map((r) => ({ x: r.recordedAt, y: r.systolicBp as number }));
    const dia = chronological
      .filter((r) => r.diastolicBp != null)
      .map((r) => ({ x: r.recordedAt, y: r.diastolicBp as number }));
    if (sys.length < 2 && dia.length < 2) return [];
    return [
      { label: 'Sistólica', values: sys, color: '#dc2626', unit: ' mmHg' },
      { label: 'Diastólica', values: dia, color: '#2563eb', unit: ' mmHg' },
    ];
  }, [chronological]);

  const bmiSeries = useMemo<Series[]>(() => {
    const values = chronological
      .filter((r) => r.bmi != null)
      .map((r) => ({ x: r.recordedAt, y: r.bmi as number }));
    return values.length >= 2
      ? [{ label: 'IMC', values, color: '#16a34a', unit: '' }]
      : [];
  }, [chronological]);

  const hasAnyChart =
    weightSeries.length > 0 || bpSeries.length > 0 || bmiSeries.length > 0;

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <Activity className="mx-auto h-6 w-6 text-zinc-300 dark:text-zinc-600" />
        <p className="mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Sin signos vitales registrados
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Los signos vitales aparecerán aquí a medida que se registren al inicio de cada consulta.
        </p>
      </div>
    );
  }

  const latest = records[0];
  const visibleHistory = showAll ? records : records.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Latest snapshot */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Últimos signos vitales
          </h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {dateFmt.format(latest.recordedAt)} · {latest.recordedByName}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="TA" value={formatBp(latest.systolicBp, latest.diastolicBp)} unit="mmHg" />
          <Stat label="FC" value={fmt(latest.heartRate)} unit="lpm" />
          <Stat label="FR" value={fmt(latest.respiratoryRate)} unit="rpm" />
          <Stat label="Temp." value={fmt(latest.temperatureC)} unit="°C" />
          <Stat label="SpO2" value={fmt(latest.oxygenSaturation)} unit="%" />
          <Stat label="Peso" value={fmt(latest.weightKg)} unit="kg" />
          <Stat label="Talla" value={fmt(latest.heightCm)} unit="cm" />
          <Stat label="IMC" value={fmt(latest.bmi)} unit="" />
        </div>
        {latest.notes && (
          <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
            {latest.notes}
          </p>
        )}
      </div>

      {/* Charts (only when ≥2 records exist for at least one metric) */}
      {hasAnyChart && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-4 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Evolución
          </h3>
          <div className="space-y-6">
            {weightSeries.length > 0 && (
              <ChartBlock title="Peso (kg)" series={weightSeries} />
            )}
            {bpSeries.length > 0 && (
              <ChartBlock
                title="Tensión arterial (mmHg)"
                series={bpSeries}
                legend={[
                  { label: 'Sistólica', color: '#dc2626' },
                  { label: 'Diastólica', color: '#2563eb' },
                ]}
              />
            )}
            {bmiSeries.length > 0 && <ChartBlock title="IMC" series={bmiSeries} />}
          </div>
        </div>
      )}

      {/* History list */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Historial ({records.length})
          </h3>
          {records.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {showAll ? (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Ver menos
                </>
              ) : (
                <>
                  <ChevronRight className="h-3.5 w-3.5" />
                  Ver todos
                </>
              )}
            </button>
          )}
        </div>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {visibleHistory.map((r) => {
            const isUnassigned = r.clinicalNoteId == null;
            return (
              <li key={r.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    {dateFmt.format(r.recordedAt)}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {r.recordedByName}
                    {isUnassigned && ' · sin nota asociada'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {r.systolicBp != null && r.diastolicBp != null && (
                      <Span k="TA" v={`${r.systolicBp}/${r.diastolicBp}`} u="mmHg" />
                    )}
                    {r.heartRate != null && <Span k="FC" v={r.heartRate} u="lpm" />}
                    {r.respiratoryRate != null && (
                      <Span k="FR" v={r.respiratoryRate} u="rpm" />
                    )}
                    {r.temperatureC != null && <Span k="T" v={r.temperatureC} u="°C" />}
                    {r.oxygenSaturation != null && (
                      <Span k="SpO2" v={r.oxygenSaturation} u="%" />
                    )}
                    {r.weightKg != null && <Span k="Peso" v={r.weightKg} u="kg" />}
                    {r.bmi != null && <Span k="IMC" v={r.bmi} u="" />}
                  </div>
                  {showAttachButton && isUnassigned && (
                    <AttachVitalSignsButton
                      vitalSignsId={r.id}
                      clinicalNoteId={attachToNoteId ?? null}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ChartBlock({
  title,
  series,
  legend,
}: {
  title: string;
  series: Series[];
  legend?: { label: string; color: string }[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{title}</p>
        {legend && <ChartLegend items={legend} />}
      </div>
      <MiniLineChart series={series} />
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/30">
      <p className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        {value}
        {value !== '—' && unit && (
          <span className="ml-1 text-xs font-normal text-zinc-400 dark:text-zinc-500">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}

function Span({ k, v, u }: { k: string; v: string | number; u: string }) {
  return (
    <span>
      <span className="text-zinc-400 dark:text-zinc-500">{k}:</span>{' '}
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{v}</span>
      {u && <span className="text-zinc-400 dark:text-zinc-500"> {u}</span>}
    </span>
  );
}

function fmt(v: number | null): string {
  return v == null ? '—' : String(v);
}

function formatBp(sys: number | null, dia: number | null): string {
  if (sys == null && dia == null) return '—';
  return `${sys ?? '—'}/${dia ?? '—'}`;
}
