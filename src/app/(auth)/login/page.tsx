import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { LoginForm } from '@/components/login-form';

export const metadata = {
  title: 'Ingresar · Hisamed',
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/inicio');

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-teal-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al inicio
      </Link>
      <div className="mb-6 space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
          Iniciar sesión
        </h2>
        <p className="text-sm text-zinc-500">
          Accede con tu correo y contraseña.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
