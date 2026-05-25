'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PatientActionState } from '@/actions/patients';
import type { Patient } from '@/lib/db/schema';
import { toDateStr } from '@/lib/dates';
import { BLOOD_TYPES } from '@/lib/validators/patient';
import { echoChecked, echoValue, formKey } from '@/lib/forms/state';

type Tab = 'personal' | 'contact' | 'insurance';

const TABS: { id: Tab; label: string }[] = [
  { id: 'personal', label: 'Datos personales' },
  { id: 'contact', label: 'Contacto' },
  { id: 'insurance', label: 'Seguro y notas' },
];

interface PatientFormProps {
  action: (state: PatientActionState, formData: FormData) => Promise<PatientActionState>;
  patient?: Patient;
  mode?: 'create' | 'edit';
  /**
   * "Today" in the clinic's timezone (YYYY-MM-DD). Used as the upper bound
   * of the date-of-birth input so a user in a different timezone than the
   * clinic cannot pick a "future" DOB that's still today for the clinic.
   */
  todayStr: string;
}

export function PatientForm({ action, patient, mode = 'create', todayStr }: PatientFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [activeTab, setActiveTab] = useState<Tab>('personal');
  const router = useRouter();

  // After a successful edit, pull fresh server data so the patient header,
  // summary card, and other RSC-rendered slots reflect the new values
  // without a manual reload. revalidatePath in the action invalidates the
  // server cache; router.refresh() re-fetches the RSC payload.
  useEffect(() => {
    if (state?.success && mode === 'edit') {
      router.refresh();
    }
  }, [state, mode, router]);

  const errors =
    state && !state.success && 'fieldErrors' in state ? state.fieldErrors : {};

  function field(name: string): string {
    return errors?.[name]?.[0] ?? '';
  }

  const dobValue = patient?.dateOfBirth
    ? typeof patient.dateOfBirth === 'string'
      ? patient.dateOfBirth
      : toDateStr(new Date(patient.dateOfBirth))
    : '';

  return (
    <form key={formKey(state)} action={formAction} className="space-y-6">
      {patient && <input type="hidden" name="patient_id" value={patient.id} />}

      {/* Global error */}
      {state && !state.success && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}

      {/* Success (edit mode only) */}
      {state && state.success && mode === 'edit' && (
        <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Datos actualizados correctamente</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="-mb-px flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                'px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-b-2 border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-400'
                  : 'border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Personal tab — all panels stay mounted so tab switching preserves
          typed values; inactive panels are hidden via CSS. */}
      <div className={panelClass(activeTab === 'personal', 'grid gap-4 sm:grid-cols-2')}>
          <div className="space-y-1.5">
            <label htmlFor="id_type" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Tipo de documento
            </label>
            <select
              id="id_type"
              name="id_type"
              defaultValue={echoValue(state, 'id_type') ?? patient?.idType ?? 'cedula'}
              className={fieldClass(!!field('id_type'))}
            >
              <option value="cedula">Cédula</option>
              <option value="passport">Pasaporte</option>
              <option value="other">Otro</option>
            </select>
            {field('id_type') && <FieldError msg={field('id_type')} />}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="id_number" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Número de documento <Required />
            </label>
            <input
              id="id_number"
              name="id_number"
              type="text"
              defaultValue={echoValue(state, 'id_number') ?? patient?.idNumber ?? ''}
              placeholder="Ej: 12345678"
              className={fieldClass(!!field('id_number'))}
            />
            {field('id_number') && <FieldError msg={field('id_number')} />}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="first_name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nombre(s) <Required />
            </label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              defaultValue={echoValue(state, 'first_name') ?? patient?.firstName ?? ''}
              placeholder="Ej: María"
              className={fieldClass(!!field('first_name'))}
            />
            {field('first_name') && <FieldError msg={field('first_name')} />}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="last_name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Apellido(s) <Required />
            </label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              defaultValue={echoValue(state, 'last_name') ?? patient?.lastName ?? ''}
              placeholder="Ej: García"
              className={fieldClass(!!field('last_name'))}
            />
            {field('last_name') && <FieldError msg={field('last_name')} />}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="date_of_birth" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Fecha de nacimiento <Required />
            </label>
            <input
              id="date_of_birth"
              name="date_of_birth"
              type="date"
              defaultValue={echoValue(state, 'date_of_birth') ?? dobValue}
              max={todayStr}
              className={fieldClass(!!field('date_of_birth'))}
            />
            {field('date_of_birth') && <FieldError msg={field('date_of_birth')} />}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sex" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Sexo <Required />
            </label>
            <select
              id="sex"
              name="sex"
              defaultValue={echoValue(state, 'sex') ?? patient?.sex ?? ''}
              className={fieldClass(!!field('sex'))}
            >
              <option value="" disabled>
                Seleccionar…
              </option>
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
              <option value="other">Otro</option>
            </select>
            {field('sex') && <FieldError msg={field('sex')} />}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="blood_type" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Grupo sanguíneo
            </label>
            <select
              id="blood_type"
              name="blood_type"
              defaultValue={echoValue(state, 'blood_type') ?? patient?.bloodType ?? ''}
              className={fieldClass(!!field('blood_type'))}
            >
              <option value="">Desconocido</option>
              {BLOOD_TYPES.map((bt) => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
            {field('blood_type') && <FieldError msg={field('blood_type')} />}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="rh_incompatibility"
              name="rh_incompatibility"
              type="checkbox"
              defaultChecked={echoChecked(state, 'rh_incompatibility') ?? patient?.rhIncompatibility ?? false}
              value="true"
              className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-600 dark:border-zinc-600"
            />
            <label htmlFor="rh_incompatibility" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Incompatibilidad Rh
            </label>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="occupation" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Ocupación
            </label>
            <input
              id="occupation"
              name="occupation"
              type="text"
              defaultValue={echoValue(state, 'occupation') ?? patient?.occupation ?? ''}
              placeholder="Ej: Enfermera, Ingeniero, Estudiante…"
              className={fieldClass(!!field('occupation'))}
            />
            {field('occupation') && <FieldError msg={field('occupation')} />}
          </div>
      </div>

      {/* Contact tab */}
      <div className={panelClass(activeTab === 'contact', 'grid gap-4 sm:grid-cols-2')}>
          <div className="space-y-1.5">
            <label htmlFor="phone" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Teléfono
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={echoValue(state, 'phone') ?? patient?.phone ?? ''}
              placeholder="Ej: 0412-5551234"
              className={fieldClass(!!field('phone'))}
            />
            {field('phone') && <FieldError msg={field('phone')} />}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={echoValue(state, 'email') ?? patient?.email ?? ''}
              placeholder="Ej: paciente@email.com"
              className={fieldClass(!!field('email'))}
            />
            {field('email') && <FieldError msg={field('email')} />}
          </div>

          <div className="col-span-full space-y-1.5">
            <label htmlFor="address" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Dirección
            </label>
            <textarea
              id="address"
              name="address"
              defaultValue={echoValue(state, 'address') ?? patient?.address ?? ''}
              rows={2}
              placeholder="Ej: Av. Principal, Edif. Torre Norte, Piso 3…"
              className={textareaClass(!!field('address'))}
            />
            {field('address') && <FieldError msg={field('address')} />}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emergency_contact_name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Contacto de emergencia
            </label>
            <input
              id="emergency_contact_name"
              name="emergency_contact_name"
              type="text"
              defaultValue={echoValue(state, 'emergency_contact_name') ?? patient?.emergencyContactName ?? ''}
              placeholder="Nombre completo"
              className={fieldClass(!!field('emergency_contact_name'))}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emergency_contact_phone" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Teléfono de emergencia
            </label>
            <input
              id="emergency_contact_phone"
              name="emergency_contact_phone"
              type="tel"
              defaultValue={echoValue(state, 'emergency_contact_phone') ?? patient?.emergencyContactPhone ?? ''}
              placeholder="Ej: 0412-5551234"
              className={fieldClass(!!field('emergency_contact_phone'))}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="instagram" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Instagram
            </label>
            <input
              id="instagram"
              name="instagram"
              type="text"
              defaultValue={echoValue(state, 'instagram') ?? patient?.instagram ?? ''}
              placeholder="Ej: @nombre_usuario"
              className={fieldClass(!!field('instagram'))}
            />
            {field('instagram') && <FieldError msg={field('instagram')} />}
          </div>

          <div className="col-span-full space-y-1.5">
            <label htmlFor="referral_source" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              ¿Cómo se enteró / quién lo recomendó?
            </label>
            <input
              id="referral_source"
              name="referral_source"
              type="text"
              defaultValue={echoValue(state, 'referral_source') ?? patient?.referralSource ?? ''}
              placeholder="Ej: Instagram, recomendación de Dra. García, Google…"
              className={fieldClass(!!field('referral_source'))}
            />
            {field('referral_source') && <FieldError msg={field('referral_source')} />}
          </div>
      </div>

      {/* Insurance/Notes tab */}
      <div className={panelClass(activeTab === 'insurance', 'space-y-4')}>
          <div className="space-y-1.5">
            <label htmlFor="insurance_info" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Información de seguro médico
            </label>
            <textarea
              id="insurance_info"
              name="insurance_info"
              defaultValue={echoValue(state, 'insurance_info') ?? patient?.insuranceInfo ?? ''}
              rows={3}
              placeholder="Aseguradora, número de póliza, cobertura…"
              className={textareaClass(!!field('insurance_info'))}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="notes" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Notas internas
            </label>
            <textarea
              id="notes"
              name="notes"
              defaultValue={echoValue(state, 'notes') ?? patient?.notes ?? ''}
              rows={4}
              placeholder="Anotaciones generales sobre el paciente…"
              className={textareaClass(!!field('notes'))}
            />
          </div>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <div className="flex gap-2">
          {activeTab !== 'personal' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveTab(activeTab === 'insurance' ? 'contact' : 'personal')}
            >
              Anterior
            </Button>
          )}
          {activeTab !== 'insurance' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (activeTab === 'personal') setActiveTab('contact');
                else setActiveTab('insurance');
              }}
            >
              Siguiente
            </Button>
          )}
        </div>
        <Button type="submit" disabled={isPending} size="sm">
          {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {mode === 'create' ? 'Registrar paciente' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}

function Required() {
  return <span className="ml-0.5 text-red-500">*</span>;
}

function FieldError({ msg }: { msg: string }) {
  return <p className="text-xs text-red-600 dark:text-red-400">{msg}</p>;
}

function panelClass(active: boolean, layout: string) {
  return active ? layout : `${layout} hidden`;
}

function fieldClass(hasError: boolean) {
  return [
    'flex h-9 w-full rounded-lg border bg-white px-3 text-sm shadow-sm outline-none transition-colors',
    'placeholder:text-zinc-400 focus:ring-2',
    'dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500',
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700'
      : 'border-zinc-200 focus:border-teal-600 focus:ring-teal-600/20 dark:border-zinc-700 dark:focus:border-teal-600',
  ].join(' ');
}

function textareaClass(hasError: boolean) {
  return [
    'w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors resize-none',
    'placeholder:text-zinc-400 focus:ring-2',
    'dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500',
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700'
      : 'border-zinc-200 focus:border-teal-600 focus:ring-teal-600/20 dark:border-zinc-700 dark:focus:border-teal-600',
  ].join(' ');
}
