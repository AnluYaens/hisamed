'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { registerClinic } from '@/actions/register-clinic';
import { COUNTRIES } from '@/lib/validators/register-clinic';
import { echoChecked, echoValue, formKey } from '@/lib/forms/state';

const inputClass =
  'flex h-12 w-full rounded-[14px] border border-slate-900/10 bg-white/85 px-4 text-[14.5px] text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background] placeholder:text-slate-400 focus-visible:border-teal-600/50 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/16 disabled:cursor-not-allowed disabled:opacity-50';

const labelClass = 'text-[13px] font-semibold text-slate-700';

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerClinic, null);

  return (
    <form key={formKey(state)} action={action} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="clinicName" className={labelClass}>
          Nombre de tu consultorio
        </label>
        <input
          id="clinicName"
          name="clinicName"
          type="text"
          autoComplete="organization"
          placeholder="Consultorio Dra. García"
          required
          defaultValue={echoValue(state, 'clinicName') ?? ''}
          className={inputClass}
          disabled={pending}
        />
        {state?.fieldErrors?.clinicName && (
          <p className="text-[12px] text-red-600">{state.fieldErrors.clinicName[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="fullName" className={labelClass}>
          Su nombre completo
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder="Dr. Ana García"
          required
          defaultValue={echoValue(state, 'fullName') ?? ''}
          className={inputClass}
          disabled={pending}
        />
        {state?.fieldErrors?.fullName && (
          <p className="text-[12px] text-red-600">{state.fieldErrors.fullName[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className={labelClass}>
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="ana@clinica.com"
          required
          defaultValue={echoValue(state, 'email') ?? ''}
          className={inputClass}
          disabled={pending}
        />
        {state?.fieldErrors?.email && (
          <p className="text-[12px] text-red-600">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className={labelClass}>
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 10 caracteres"
          required
          className={inputClass}
          disabled={pending}
        />
        {state?.fieldErrors?.password && (
          <p className="text-[12px] text-red-600">{state.fieldErrors.password[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className={labelClass}>
          Confirmar contraseña
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Repite tu contraseña"
          required
          className={inputClass}
          disabled={pending}
        />
        {state?.fieldErrors?.confirmPassword && (
          <p className="text-[12px] text-red-600">{state.fieldErrors.confirmPassword[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="country" className={labelClass}>
          País
        </label>
        <select
          id="country"
          name="country"
          required
          defaultValue={echoValue(state, 'country') ?? ''}
          className={inputClass + ' cursor-pointer appearance-none'}
          disabled={pending}
        >
          <option value="" disabled>
            Selecciona tu país
          </option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {state?.fieldErrors?.country && (
          <p className="text-[12px] text-red-600">{state.fieldErrors.country[0]}</p>
        )}
      </div>

      <div className="flex items-start gap-2.5 pt-0.5">
        <input
          id="terms"
          name="terms"
          type="checkbox"
          value="on"
          required
          defaultChecked={echoChecked(state, 'terms') ?? false}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-teal-600"
          disabled={pending}
        />
        <label htmlFor="terms" className="cursor-pointer text-[13px] text-slate-600 leading-snug">
          Acepto los{' '}
          <span className="font-medium text-teal-700 hover:underline cursor-pointer">
            términos de servicio
          </span>{' '}
          y la{' '}
          <span className="font-medium text-teal-700 hover:underline cursor-pointer">
            política de privacidad
          </span>
        </label>
      </div>
      {state?.fieldErrors?.terms && (
        <p className="text-[12px] text-red-600">{state.fieldErrors.terms[0]}</p>
      )}

      {state && !state.success && !state.fieldErrors && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-red-600/20 bg-red-100/80 px-3.5 py-3 text-[13.5px] text-red-700 backdrop-blur-md"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <Button type="submit" disabled={pending} className="h-11 w-full text-sm">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creando cuenta…
          </>
        ) : (
          'Crear cuenta gratis'
        )}
      </Button>

      <p className="text-center text-[13px] text-slate-500">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-semibold text-teal-700 hover:underline">
          Ingresar
        </Link>
      </p>
    </form>
  );
}
