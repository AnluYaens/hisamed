import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { RegisterForm } from '@/components/register-form';

export const metadata = {
  title: 'Crear cuenta · Hisamed',
};

export default async function RegistroPage() {
  const session = await getSession();
  if (session) redirect('/');

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm sm:p-8">
      <div className="mb-6 space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
          Crea tu cuenta
        </h2>
        <p className="text-sm text-zinc-500">
          Empieza a usar Hisamed en tu consulta — 7 días de prueba, sin tarjeta de crédito.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
