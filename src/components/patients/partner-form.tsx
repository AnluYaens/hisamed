'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { upsertPatientPartner, type PatientActionState } from '@/actions/patients';
import type { PatientPartner } from '@/lib/db/schema';
import { BLOOD_TYPES } from '@/lib/validators/patient';

interface PartnerFormProps {
  patientId: string;
  partner?: PatientPartner | null;
}

export function PartnerForm({ patientId, partner }: PartnerFormProps) {
  const [state, formAction, isPending] = useActionState(upsertPatientPartner, null);

  const errors =
    state && !state.success && 'fieldErrors' in state ? state.fieldErrors : {};

  function field(name: string): string {
    return errors?.[name]?.[0] ?? '';
  }

  const dobValue = partner?.dateOfBirth
    ? typeof partner.dateOfBirth === 'string'
      ? partner.dateOfBirth
      : partner.dateOfBirth
    : '';

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="patient_id" value={patientId} />

      {state && !state.success && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}

      {state && state.success && (
        <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Datos de la pareja actualizados correctamente</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="col-span-full space-y-1.5">
          <label htmlFor="partner_full_name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nombre completo <span className="ml-0.5 text-red-500">*</span>
          </label>
          <input
            id="partner_full_name"
            name="full_name"
            type="text"
            defaultValue={partner?.fullName ?? ''}
            placeholder="Ej: Carlos Pérez"
            className={fieldClass(!!field('full_name'))}
          />
          {field('full_name') && <p className="text-xs text-red-600 dark:text-red-400">{field('full_name')}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="partner_id_number" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Documento de identidad
          </label>
          <input
            id="partner_id_number"
            name="id_number"
            type="text"
            defaultValue={partner?.idNumber ?? ''}
            placeholder="Ej: 12345678"
            className={fieldClass(!!field('id_number'))}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="partner_date_of_birth" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Fecha de nacimiento
          </label>
          <input
            id="partner_date_of_birth"
            name="date_of_birth"
            type="date"
            defaultValue={dobValue}
            className={fieldClass(!!field('date_of_birth'))}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="partner_phone" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Teléfono
          </label>
          <input
            id="partner_phone"
            name="phone"
            type="tel"
            defaultValue={partner?.phone ?? ''}
            placeholder="Ej: 0412-5551234"
            className={fieldClass(!!field('phone'))}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="partner_email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <input
            id="partner_email"
            name="email"
            type="email"
            defaultValue={partner?.email ?? ''}
            placeholder="Ej: pareja@email.com"
            className={fieldClass(!!field('email'))}
          />
          {field('email') && <p className="text-xs text-red-600 dark:text-red-400">{field('email')}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="partner_blood_type" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Grupo sanguíneo
          </label>
          <select
            id="partner_blood_type"
            name="blood_type"
            defaultValue={partner?.bloodType ?? ''}
            className={fieldClass(!!field('blood_type'))}
          >
            <option value="">Desconocido</option>
            {BLOOD_TYPES.map((bt) => (
              <option key={bt} value={bt}>{bt}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="partner_occupation" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Ocupación
          </label>
          <input
            id="partner_occupation"
            name="occupation"
            type="text"
            defaultValue={partner?.occupation ?? ''}
            placeholder="Ej: Ingeniero, Docente…"
            className={fieldClass(false)}
          />
        </div>

        <div className="col-span-full space-y-1.5">
          <label htmlFor="partner_notes" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Notas
          </label>
          <textarea
            id="partner_notes"
            name="notes"
            defaultValue={partner?.notes ?? ''}
            rows={3}
            placeholder="Observaciones sobre la pareja…"
            className={textareaClass(false)}
          />
        </div>
      </div>

      <div className="flex justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <Button type="submit" disabled={isPending} size="sm">
          {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {partner ? 'Guardar cambios' : 'Registrar pareja'}
        </Button>
      </div>
    </form>
  );
}

function fieldClass(hasError: boolean) {
  return [
    'flex h-9 w-full rounded-lg border bg-white px-3 text-sm shadow-sm outline-none transition-colors',
    'placeholder:text-zinc-400 focus:ring-2',
    'dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500',
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700'
      : 'border-zinc-200 focus:border-blue-500 focus:ring-blue-500/20 dark:border-zinc-700 dark:focus:border-blue-500',
  ].join(' ');
}

function textareaClass(hasError: boolean) {
  return [
    'w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors resize-none',
    'placeholder:text-zinc-400 focus:ring-2',
    'dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500',
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700'
      : 'border-zinc-200 focus:border-blue-500 focus:ring-blue-500/20 dark:border-zinc-700 dark:focus:border-blue-500',
  ].join(' ');
}
