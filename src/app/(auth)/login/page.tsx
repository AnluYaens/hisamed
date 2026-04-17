import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { LoginForm } from '@/components/login-form';

export const metadata = {
  title: 'Ingresar · ClinicaMVP',
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/');

  return (
    <div className="rounded-xl border border-border bg-background p-8 shadow-sm">
      <div className="mb-6 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Iniciar sesión
        </h1>
        <p className="text-sm text-muted-foreground">
          Accede con tu correo y contraseña.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
