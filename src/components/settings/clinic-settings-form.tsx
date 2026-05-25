'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ClinicActionState } from '@/actions/clinic';
import type { FullClinic } from '@/queries/clinic';
import { echoValue, formKey } from '@/lib/forms/state';

const TIMEZONES = [
  'America/Caracas',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/Mexico_City',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/Madrid',
  'Europe/London',
  'UTC',
];

interface ClinicSettingsFormProps {
  clinic: FullClinic;
  action: (state: ClinicActionState, formData: FormData) => Promise<ClinicActionState>;
}

export function ClinicSettingsForm({ clinic, action }: ClinicSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);

  const errors =
    state && !state.success && 'fieldErrors' in state ? state.fieldErrors : {};

  function field(name: string) {
    return errors?.[name]?.[0] ?? '';
  }

  return (
    <form key={formKey(state)} action={formAction} className="space-y-5">
      {state && !state.success && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-red-600/20 bg-red-100/70 px-4 py-3 text-sm text-red-700 backdrop-blur-md">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}

      {state?.success && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-green-600/20 bg-green-100/70 px-4 py-3 text-sm text-green-700 backdrop-blur-md">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Configuración actualizada correctamente</p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nombre del consultorio <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            type="text"
            defaultValue={echoValue(state, 'name') ?? clinic.name}
            required
            className="glass-input w-full rounded-[14px] px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none"
          />
          {field('name') && <p className="mt-1 text-xs text-red-600">{field('name')}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Dirección
          </label>
          <textarea
            name="address"
            rows={2}
            defaultValue={echoValue(state, 'address') ?? clinic.address ?? ''}
            className="glass-input w-full rounded-[14px] px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Teléfono
          </label>
          <input
            name="phone"
            type="tel"
            defaultValue={echoValue(state, 'phone') ?? clinic.phone ?? ''}
            className="glass-input w-full rounded-[14px] px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Zona horaria <span className="text-red-500">*</span>
          </label>
          <select
            name="timezone"
            defaultValue={echoValue(state, 'timezone') ?? clinic.timezone}
            className="glass-input w-full rounded-[14px] px-3.5 py-2.5 text-sm text-slate-900 outline-none"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          {field('timezone') && (
            <p className="mt-1 text-xs text-red-600">{field('timezone')}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Inicio de semana
          </label>
          <select
            name="week_starts_on"
            defaultValue={echoValue(state, 'week_starts_on') ?? String(clinic.weekStartsOn)}
            className="glass-input w-full rounded-[14px] px-3.5 py-2.5 text-sm text-slate-900 outline-none"
          >
            <option value="1">Lunes</option>
            <option value="0">Domingo</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
