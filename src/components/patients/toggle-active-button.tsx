'use client';

import { useActionState } from 'react';
import { Loader2, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { togglePatientActive } from '@/actions/patients';
import type { PatientActionState } from '@/actions/patients';

interface ToggleActiveButtonProps {
  patientId: string;
  isActive: boolean;
}

export function ToggleActiveButton({ patientId, isActive }: ToggleActiveButtonProps) {
  const [state, formAction, isPending] = useActionState<PatientActionState, FormData>(
    togglePatientActive,
    null,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="patient_id" value={patientId} />
      <Button
        type="submit"
        variant={isActive ? 'destructive' : 'outline'}
        size="sm"
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isActive ? (
          <>
            <UserX className="h-3.5 w-3.5" />
            Desactivar paciente
          </>
        ) : (
          <>
            <UserCheck className="h-3.5 w-3.5" />
            Activar paciente
          </>
        )}
      </Button>
      {state && !state.success && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
