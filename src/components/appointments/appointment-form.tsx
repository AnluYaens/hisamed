'use client';

import { useActionState, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { PatientCombobox } from '@/components/appointments/patient-combobox';
import { createAppointment } from '@/actions/appointments';
import type { AppointmentActionState } from '@/actions/appointments';
import { echoValue, formKey } from '@/lib/forms/state';

interface Doctor {
  id: string;
  fullName: string;
}

interface AppointmentFormProps {
  doctors: Doctor[];
  /**
   * "Today" in the clinic's timezone (YYYY-MM-DD). Used as the `min` of the
   * date input and as the fallback default date. Required so the form
   * behaves consistently regardless of the user's browser timezone.
   */
  todayStr: string;
  defaultDate?: string;
  defaultDoctorId?: string;
}

export function AppointmentFormDrawer({ doctors, todayStr, defaultDate, defaultDoctorId }: AppointmentFormProps) {
  const [state, action, isPending] = useActionState<AppointmentActionState, FormData>(
    createAppointment,
    null,
  );

  const [open, setOpen] = useState(false);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="default" size="sm">
            <Plus className="h-4 w-4" />
            Nueva cita
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nueva cita</SheetTitle>
          <SheetDescription>Registra una nueva cita para un paciente</SheetDescription>
        </SheetHeader>

        <form key={formKey(state)} action={action} className="flex flex-col gap-4 px-4 pb-4">
          {state && !state.success && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              {state.error}
            </div>
          )}

          {/* Patient */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Paciente <span className="text-red-500">*</span>
            </label>
            <PatientCombobox name="patient_id" error={fieldErrors?.patient_id?.[0]} />
          </div>

          {/* Doctor */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="doctor_id" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Médico <span className="text-red-500">*</span>
            </label>
            <select
              id="doctor_id"
              name="doctor_id"
              defaultValue={echoValue(state, 'doctor_id') ?? defaultDoctorId ?? ''}
              className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">Seleccionar médico…</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                </option>
              ))}
            </select>
            {fieldErrors?.doctor_id && (
              <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.doctor_id[0]}</p>
            )}
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="appt-date" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              id="appt-date"
              type="date"
              name="date"
              defaultValue={echoValue(state, 'date') ?? defaultDate ?? todayStr}
              min={todayStr}
              className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {fieldErrors?.date && (
              <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.date[0]}</p>
            )}
          </div>

          {/* Times */}
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="start_time" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Hora inicio <span className="text-red-500">*</span>
              </label>
              <input
                id="start_time"
                type="time"
                name="start_time"
                defaultValue={echoValue(state, 'start_time') ?? '08:00'}
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              {fieldErrors?.start_time && (
                <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.start_time[0]}</p>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="end_time" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Hora fin
              </label>
              <input
                id="end_time"
                type="time"
                name="end_time"
                defaultValue={echoValue(state, 'end_time') ?? '08:30'}
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {/* Reason */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reason" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Motivo de consulta
            </label>
            <textarea
              id="reason"
              name="reason"
              rows={2}
              maxLength={500}
              defaultValue={echoValue(state, 'reason') ?? ''}
              placeholder="Ej: Consulta de rutina, control prenatal…"
              className="w-full resize-none rounded-lg border border-zinc-200 bg-white p-2.5 text-sm shadow-sm outline-none placeholder:text-zinc-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>

          <SheetFooter className="px-0 pt-2">
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? 'Guardando…' : 'Guardar cita'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
