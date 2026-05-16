'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { REPORT_RANGE_PRESETS, type ReportRangePreset } from '@/lib/reports/date-range';

interface ReportFiltersProps {
  preset: ReportRangePreset;
  from: string;
  to: string;
  doctorId: string;
  /** Empty when the viewer is not an admin — hides the doctor filter. */
  doctors: { id: string; fullName: string }[];
  canFilterByDoctor: boolean;
}

const SELECT_CLASS =
  'h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100';

export function ReportFilters({
  preset,
  from,
  to,
  doctorId,
  doctors,
  canFilterByDoctor,
}: ReportFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Período
          </label>
          <select
            value={preset}
            onChange={(e) => setParam({ preset: e.target.value })}
            className={SELECT_CLASS}
          >
            {REPORT_RANGE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {preset === 'custom' && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Desde
              </label>
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setParam({ from: e.target.value })}
                className={SELECT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Hasta
              </label>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setParam({ to: e.target.value })}
                className={SELECT_CLASS}
              />
            </div>
          </>
        )}

        {canFilterByDoctor && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Médico
            </label>
            <select
              value={doctorId}
              onChange={(e) => setParam({ doctorId: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Todos los médicos</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
